import { verify } from '../context-control-cli/index.ts';
export declare const A2A_CAPABILITY_ID = "maha.context-control.evaluate";
export declare const A2A_AGENT_VERSION = "0.1.0";
/**
 * The agent card.
 *
 * `payments`, `externalTaskCreation` and `documentRetention` are declared false
 * rather than omitted: a consumer deciding whether to trust this agent should
 * read the answer, not infer it from an absence.
 */
/**
 * The task envelope `handleA2ATask` enforces, published on the agent card.
 *
 * Exported so the card and the handler cannot drift: a test asserts that a task
 * built from this schema is accepted. Without a published schema an independent
 * caller has to guess the envelope from prose, and the natural guesses — `id`
 * rather than `taskId`, a nested `input.payload` rather than `request`, an
 * implied default budget — are all rejected. That gap was found by a caller
 * that read only the card, which is exactly the caller this schema is for.
 */
export declare const A2A_TASK_INPUT_SCHEMA: Record<string, unknown>;
export declare function a2aAgentCard(baseUrl?: string): Record<string, unknown>;
export type A2ATaskState = 'submitted' | 'completed' | 'failed' | 'rejected';
export type A2ATaskResult = {
    capability: typeof A2A_CAPABILITY_ID;
    state: A2ATaskState;
    /** True when this exact taskId was already answered; the result is replayed. */
    replayed: boolean;
    /** Explicit, because a caller must know whether a human still has to act. */
    approvalRequired: false;
    policy: {
        version: string;
        tokenBudget: number | null;
        minimumCompileTokens: number | null;
    };
    evidence?: Record<string, unknown>;
    failure?: {
        code: string;
        message: string;
    };
    boundaries: {
        sourceDocumentsRetained: false;
        paymentsInitiated: false;
        externalTasksCreated: false;
    };
};
export declare function resetA2AReplayMemory(): void;
/**
 * Handle one context-control task.
 *
 * The policy is the caller's and must be explicit: a task without a declared
 * token budget is rejected rather than given a default, because a budget the
 * caller did not choose is not a bounded evaluation.
 */
export declare function handleA2ATask(task: unknown): A2ATaskResult;
/** Structural verification of evidence, re-exported so an A2A client needs one dependency. */
export { verify as verifyContextEvidence };
//# sourceMappingURL=index.d.ts.map