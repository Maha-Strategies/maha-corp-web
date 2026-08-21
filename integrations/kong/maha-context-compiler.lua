-- Maha Context Compiler — Kong plugin (access phase)
--
-- Runs before Kong proxies upstream. Reads the request body, calls the Maha
-- compiler, and replaces the body with the rewritten one. Fails closed: any
-- error terminates the request rather than forwarding an uncompiled prompt to
-- the provider.
--
-- The secret is read from the environment, never from the declarative config.
-- Nothing from the request body is logged.
local http = require "resty.http"
local cjson = require "cjson.safe"

local MahaContextCompiler = {
  PRIORITY = 1000, -- after auth, before proxying
  VERSION = "1.0.0",
}

local EVIDENCE_HEADERS = {
  "x-maha-compiled",
  "x-maha-input-hash",
  "x-maha-output-hash",
  "x-maha-token-budget",
  "x-maha-retained-passages",
  "x-maha-source-coverage-bps",
  "x-maha-policy-version",
}

local function fail(status, code, message)
  -- Deliberately terminal. passthrough-on-error would send an uncompiled
  -- prompt to a paid provider and report success.
  return kong.response.exit(status, { error = { code = code, message = message } },
    { ["content-type"] = "application/json", ["cache-control"] = "no-store" })
end

function MahaContextCompiler:access(config)
  local secret = os.getenv(config.secret_env or "MAHA_CONTEXT_INTERCEPTOR_SECRET")
  if not secret or #secret < 32 then
    return fail(503, "interceptor_not_configured", "The Maha context interceptor is not configured.")
  end

  -- Idempotence: a body already compiled upstream must not be compiled again.
  if kong.request.get_header("x-maha-compiled") == "true" then return end

  kong.service.request.enable_buffering()
  local body, err = kong.request.get_raw_body()
  if err then return fail(400, "invalid_envelope", "The request body could not be read.") end
  if not body or #body == 0 then return end
  if #body > (config.max_body_bytes or 512000) then
    return fail(413, "payload_too_large", "Request body exceeds the configured limit.")
  end

  local parsed = cjson.decode(body)
  if not parsed then return fail(400, "invalid_envelope", "The request body must be JSON.") end
  -- No opt-in, no work. The plugin is safe to attach to a broader route.
  if parsed.maha_context == nil then return end

  local client = http.new()
  client:set_timeout(config.timeout_ms or 3000)
  local response, request_err = client:request_uri(config.compiler_url, {
    method = "POST",
    body = body,
    headers = {
      ["content-type"] = "application/json",
      ["x-maha-interceptor-token"] = secret,
    },
  })

  -- Unavailable or slow compiler is a refusal, not a passthrough.
  if not response then
    return fail(503, "compiler_unavailable", "The context compiler is unavailable.")
  end
  if response.status ~= 200 then
    local detail = cjson.decode(response.body or "")
    local code = detail and detail.error and detail.error.code or "context_compilation_rejected"
    return fail(response.status, code, "The context compiler refused the request.")
  end

  local result = cjson.decode(response.body or "")
  if not result then return fail(502, "invalid_compiler_output", "The compiler returned an unusable result.") end
  if result.outcome == "passthrough" then return end
  if result.outcome ~= "compiled" or type(result.body) ~= "table" then
    return fail(502, "invalid_compiler_output", "The compiler returned an unusable result.")
  end

  local rewritten = cjson.encode(result.body)
  kong.service.request.set_raw_body(rewritten)
  kong.service.request.set_header("content-length", tostring(#rewritten))
  kong.service.request.set_header("x-maha-compiled", "true")

  -- Evidence is returned to the caller, not sent to the model provider.
  for _, name in ipairs(EVIDENCE_HEADERS) do
    local value = response.headers[name]
    if value then kong.response.set_header(name, value) end
  end
end

return MahaContextCompiler
