// Decide whether this request opts in, before any callout is made.
// Nothing from the body is logged or copied into a variable that outlives the
// flow; only the decision and the payload the callout needs.
var MAX_BODY_BYTES = 512000;

function fail(status, code) {
  context.setVariable('maha.compile.required', 'true');
  context.setVariable('maha.compile.ok', 'false');
  context.setVariable('maha.compile.status', String(status));
  context.setVariable('maha.compile.code', code);
}

context.setVariable('maha.compile.required', 'false');
context.setVariable('maha.compile.ok', 'false');

// Idempotence: an upstream hop already compiled this body.
if (context.getVariable('request.header.x-maha-compiled') === 'true') {
  // leave required=false; the original body proceeds untouched
} else {
  var raw = context.getVariable('request.content');
  if (raw && raw.length > 0) {
    if (raw.length > MAX_BODY_BYTES) {
      fail(413, 'payload_too_large');
    } else {
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (parsed === null) {
        fail(400, 'invalid_envelope');
      } else if (parsed.maha_context !== undefined) {
        context.setVariable('maha.compile.required', 'true');
        context.setVariable('maha.compile.payload', raw);
        context.setVariable('maha.compile.status', '502');
        context.setVariable('maha.compile.code', 'compiler_unavailable');
      }
    }
  }
}
