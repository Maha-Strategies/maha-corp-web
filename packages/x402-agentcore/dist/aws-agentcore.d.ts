/**
 * Concrete Amazon Bedrock AgentCore Payments adapter.
 *
 * Management and payment execution clients are deliberately separate. The
 * application owns policy authorization; this adapter only creates a bounded
 * session, asks AgentCore for one CRYPTO_X402 proof, and deletes the session.
 */
import { type BedrockAgentCoreClient } from '@aws-sdk/client-bedrock-agentcore';
import type { AgentCorePaymentsAdapter } from './agentcore.ts';
export declare const AWS_AGENTCORE_ADAPTER_VERSION: "0.1.0";
export type AwsAgentCoreSessionHandle = {
    paymentSessionId: string;
    paymentManagerArn: string;
    userId: string;
};
type CommandClient = Pick<BedrockAgentCoreClient, 'send'>;
export type AwsAgentCoreSessionJournal = {
    created(handle: AwsAgentCoreSessionHandle): Promise<void>;
    deleted(handle: AwsAgentCoreSessionHandle): Promise<void>;
};
export type AwsAgentCorePaymentsConfig = {
    /** Client authenticated with the management role. */
    managementClient: CommandClient;
    /** Client authenticated with the ProcessPayment execution role. */
    executionClient: CommandClient;
    paymentManagerArn: string;
    paymentInstrumentId: string;
    userId: string;
    agentName: string;
    /** USDC uses six decimals. Override only for another USD-denominated asset. */
    assetDecimals?: number;
    journal?: AwsAgentCoreSessionJournal;
};
export declare function baseUnitsToUsd(value: string, decimals?: number): string;
/**
 * Creates an adapter around the official AWS JavaScript SDK commands.
 * Configure both SDK clients with maxAttempts: 1; the constructor verifies
 * distinct client objects. The caller must bind those clients to distinct IAM
 * roles; the Sepolia runner additionally checks distinct role ARNs.
 */
export declare function createAwsAgentCorePaymentsAdapter(config: AwsAgentCorePaymentsConfig): AgentCorePaymentsAdapter;
/** Read-only recovery check for an operator before attempting cleanup. */
export declare function inspectAwsAgentCorePaymentSession(managementClient: CommandClient, handle: AwsAgentCoreSessionHandle, agentName: string): Promise<import("@aws-sdk/client-bedrock-agentcore").PaymentSession | undefined>;
export {};
//# sourceMappingURL=aws-agentcore.d.ts.map