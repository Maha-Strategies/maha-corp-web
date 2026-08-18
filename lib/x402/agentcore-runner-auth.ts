export type AgentCoreRunnerCredentialConfig = {
  managementProfile: string
  executionProfile: string
  managementRoleArn: string
  executionRoleArn: string
}

export function agentCoreCredentialMode(config: AgentCoreRunnerCredentialConfig): 'profiles' | 'roles' | 'invalid' {
  const profiles = Boolean(config.managementProfile && config.executionProfile)
  const roles = Boolean(config.managementRoleArn && config.executionRoleArn)
  return profiles !== roles ? (profiles ? 'profiles' : 'roles') : 'invalid'
}
