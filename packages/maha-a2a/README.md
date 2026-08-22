# @mahastrategies/maha-a2a

An A2A agent card and handler for one bounded capability: evaluating a
context-control task and returning sanitized evidence.

**This is a protocol wrapper, not an orchestrator.** It holds no queue, starts
no external task, schedules nothing, and initiates no payment. Maha's durable
task state and approvals live in the application; wrapping them again here would
create a second place where a workflow's truth is kept.

## Capability

`maha.context-control.evaluate` — accepts a task with an explicit policy and
budget, returns evidence metadata, and makes replay, approval and failure state
explicit fields rather than something to infer.

```ts
import { a2aAgentCard, handleA2ATask } from '@mahastrategies/maha-a2a'

const result = handleA2ATask({
  taskId: 'caller-chosen-stable-id',
  policy: { tokenBudget: 800 },
  request: { messages: [...], maha_context: { ... } },
})
// result.state         'submitted' | 'completed' | 'failed' | 'rejected'
// result.replayed      true when this taskId was already answered
// result.approvalRequired  always false: this capability needs no human gate
```

## The budget must be yours

A task without `policy.tokenBudget` is **rejected**, not given a default. A
budget the caller did not choose is not a bounded evaluation.

## Declared boundaries

The agent card states `payments: false`, `externalTaskCreation: false`,
`documentRetention: false`, `credentialsAccepted: false` and
`providerCalls: false` explicitly, rather than omitting them. Someone deciding
whether to trust this agent should read the answer, not infer it from an
absence.

Credentials in a task field are refused loudly rather than ignored quietly.

MIT licensed. Prerelease: `0.1.0`.
