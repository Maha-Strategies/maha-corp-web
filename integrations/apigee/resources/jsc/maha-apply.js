// Replace the request payload with the compiled body, or leave the flow in a
// not-ok state so RaiseFault refuses the request. There is no branch here that
// lets an uncompiled prompt reach the target.
var EVIDENCE = [
  'x-maha-compiled',
  'x-maha-input-hash',
  'x-maha-output-hash',
  'x-maha-token-budget',
  'x-maha-retained-passages',
  'x-maha-source-coverage-bps',
  'x-maha-policy-version'
];

var status = context.getVariable('maha.compile.response.status.code');
var raw = context.getVariable('maha.compile.response.content');

if (String(status) !== '200' || !raw) {
  context.setVariable('maha.compile.ok', 'false');
  context.setVariable('maha.compile.status', String(status || 503));
  context.setVariable('maha.compile.code', 'compiler_unavailable');
} else {
  var result = null;
  try { result = JSON.parse(raw); } catch (e) { result = null; }

  if (result && result.outcome === 'passthrough') {
    // Not opted in, or already compiled. Forward the original unchanged.
    context.setVariable('maha.compile.required', 'false');
    context.setVariable('maha.compile.ok', 'true');
  } else if (result && result.outcome === 'compiled' && result.body) {
    var rewritten = JSON.stringify(result.body);
    request.content = rewritten;
    context.setVariable('request.header.content-length', String(rewritten.length));
    context.setVariable('request.header.x-maha-compiled', 'true');
    for (var i = 0; i < EVIDENCE.length; i++) {
      var value = context.getVariable('maha.compile.response.header.' + EVIDENCE[i]);
      if (value) context.setVariable('response.header.' + EVIDENCE[i], value);
    }
    context.setVariable('maha.compile.ok', 'true');
  } else {
    context.setVariable('maha.compile.ok', 'false');
    context.setVariable('maha.compile.status', '502');
    context.setVariable('maha.compile.code', 'invalid_compiler_output');
  }
}
