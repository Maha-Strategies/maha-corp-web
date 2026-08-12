import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const WORKFLOWS = new URL('../.github/workflows/', import.meta.url).pathname

/**
 * Comment lines are dropped before scanning. They legitimately *discuss* the
 * mistake -- this very workflow explains why `-c` cannot expand variables --
 * and a checker that cannot tell an explanation from an instance flags the
 * documentation that exists to prevent it.
 */
function shellLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

function workflows(): Array<{ name: string; text: string }> {
  return readdirSync(WORKFLOWS)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => ({ name: file, text: shellLines(readFileSync(join(WORKFLOWS, file), 'utf8')) }))
}

/**
 * psql expands `:'var'` only on its normal input path -- a file or stdin. With
 * `-c` the string is handed to the server verbatim, so the tokens arrive as
 * literal SQL and the server answers `syntax error at or near ":"`.
 *
 * This cost a Production diagnostic run that had already cleared a reviewer
 * gate: it failed before reading a single row, and the failure looks nothing
 * like its cause. The rule is cheap to check and the mistake is easy to repeat,
 * so it is checked rather than remembered.
 */
test('a workflow never combines psql -c with :\'variable\' interpolation', () => {
  // Deliberately checked per file rather than per invocation. The run this
  // guard exists for passed its SQL through a shell wrapper --
  // `run() { psql ... -c "$1"; }` -- so the -c and the :'var' tokens never
  // shared a line, and a per-invocation check sees nothing wrong. Indirection
  // is the normal way to write this, so the check has to survive it.
  //
  // The over-approximation is intended: -f is always a correct way to write
  // these, so a false positive pushes toward the safe form rather than away.
  for (const { name, text } of workflows()) {
    const invocations = text.match(/psql[^\n]*(?:\\\n[^\n]*)*/g) ?? []
    const usesCommandFlag = invocations.some((invocation) => /\s-c\s/.test(invocation))
    if (!usesCommandFlag) continue
    const token = text.match(/:'[a-zA-Z_][a-zA-Z0-9_]*'/)
    assert.ok(
      !token,
      `${name}: this workflow runs psql -c and contains ${token?.[0]}. `
        + 'psql expands :\'var\' only from a file or stdin, so the token reaches the server literally '
        + 'and fails with `syntax error at or near ":"`. Write the SQL to a file and use -f.',
    )
  }
})

test('a psql invocation that passes -v also reads from a file or stdin', () => {
  // The mirror of the rule above. Supplying variables and then giving psql no
  // path on which to expand them is the same defect wearing different clothes.
  for (const { name, text } of workflows()) {
    const invocations = text.match(/psql[^\n]*(?:\\\n[^\n]*)*/g) ?? []
    for (const invocation of invocations) {
      if (!/\s-v\s+[a-zA-Z_][a-zA-Z0-9_]*=/.test(invocation)) continue
      // ON_ERROR_STOP is a psql setting rather than a query variable, so an
      // invocation that only sets that is not making a substitution claim.
      const onlySetsErrorStop = !/\s-v\s+(?!ON_ERROR_STOP)[a-zA-Z_][a-zA-Z0-9_]*=/.test(invocation)
      if (onlySetsErrorStop) continue
      assert.ok(
        /\s-f\s/.test(invocation) || /<\s*\S/.test(invocation) || /\|\s*psql/.test(invocation),
        `${name}: this psql call supplies -v variables but reads no file or stdin, so they cannot expand.\n  ${invocation.slice(0, 160)}`,
      )
    }
  }
})

test('the MPS diagnostic reads only, and says so in a way a machine can check', () => {
  const diagnostic = readFileSync(join(WORKFLOWS, 'mps-settlement-diagnostic.yml'), 'utf8')
  // Statement keywords that write. Matched on the SQL body rather than on
  // comments, which legitimately discuss what the workflow refuses to do.
  const sqlBody = diagnostic.slice(diagnostic.indexOf("cat > diagnostic.sql"), diagnostic.indexOf('SQL\n', diagnostic.indexOf('cat > diagnostic.sql')))
  for (const write of ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', 'create ']) {
    assert.ok(!sqlBody.toLowerCase().includes(write), `the diagnostic SQL must not contain "${write.trim()}"`)
  }
  assert.ok(diagnostic.includes('-f diagnostic.sql'), 'the diagnostic must run from a file so variables expand')
  assert.ok(diagnostic.includes("if: always()"), 'evidence must upload even when the diagnostic fails')
})
