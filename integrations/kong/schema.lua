-- Declarative schema. Note what is absent: there is no `secret` field, because
-- a secret in a Kong declarative config is a secret in version control.
return {
  name = "maha-context-compiler",
  fields = {
    { config = {
        type = "record",
        fields = {
          { compiler_url = { type = "string", required = true } },
          { secret_env = { type = "string", default = "MAHA_CONTEXT_INTERCEPTOR_SECRET" } },
          { timeout_ms = { type = "integer", default = 3000, between = { 100, 30000 } } },
          { max_body_bytes = { type = "integer", default = 512000, between = { 1024, 10485760 } } },
        },
      },
    },
  },
}
