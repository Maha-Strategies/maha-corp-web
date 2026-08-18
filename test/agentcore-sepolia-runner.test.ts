import assert from 'node:assert/strict'
import test from 'node:test'

import { agentCoreCredentialMode, type AgentCoreRunnerCredentialConfig } from '../lib/x402/agentcore-runner-auth.ts'

const empty: AgentCoreRunnerCredentialConfig = {
  managementProfile: '',
  executionProfile: '',
  managementRoleArn: '',
  executionRoleArn: '',
}

test('AgentCore runner accepts two direct profiles without role chaining', () => {
  assert.equal(agentCoreCredentialMode({
    ...empty,
    managementProfile: 'maha-agentcore-management-direct',
    executionProfile: 'maha-agentcore-execution-direct',
  }), 'profiles')
})

test('AgentCore runner retains the two-role credential mode', () => {
  assert.equal(agentCoreCredentialMode({
    ...empty,
    managementRoleArn: 'arn:aws:iam::123456789012:role/management',
    executionRoleArn: 'arn:aws:iam::123456789012:role/execution',
  }), 'roles')
})

test('AgentCore runner rejects mixed or ambiguous credential configuration', () => {
  assert.equal(agentCoreCredentialMode(empty), 'invalid')
  assert.equal(agentCoreCredentialMode({
    ...empty,
    managementProfile: 'management',
    executionProfile: 'execution',
    managementRoleArn: 'arn:aws:iam::123456789012:role/management',
    executionRoleArn: 'arn:aws:iam::123456789012:role/execution',
  }), 'invalid')
})
