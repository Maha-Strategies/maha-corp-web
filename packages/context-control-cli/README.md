# @mahastrategies/context-control-cli

`maha-context` — evaluate Maha's context control locally, or in CI.

Every command is safe on a laptop with no credentials. Nothing makes a provider
call, and nothing prints a secret.

## Install

```sh
npm install -g @mahastrategies/context-control-cli
```

## Commands

```sh
maha-context doctor
```
Validates configuration. Reports a secret by presence and length only. **Exits
non-zero when configuration is incomplete or unsafe** — including a plaintext
non-local endpoint — so it works as a CI gate.

```sh
maha-context compile --input sanitized.json --output evidence.json
```
Compiles one sanitized fixture against `MAHA_COMPILER_URL` and writes an
evidence record. The rewritten prompt is deliberately **not** written: putting
source text in a file the caller may commit is a worse outcome than an
incomplete artifact.

```sh
maha-context verify --input evidence.json
```
Checks structure, hash formatting, policy version, budget fields and
failure-state consistency. Each finding is labelled `locally` or
`trusted-passthrough` — whether a hash commits to bytes this file never
contained is not something it can check, and it says so rather than implying
otherwise.

```sh
maha-context gateway validate <wso2|kong|apigee|cloudflare>
```
Static artifact validation. Deploys nothing, contacts nothing.

## Shell completion

Optional, and no command depends on it:

```sh
maha-context completion bash >> ~/.bashrc
maha-context completion zsh  >> ~/.zshrc
```

## Environment

`MAHA_CONTEXT_INTERCEPTOR_SECRET` (or `WSO2_CONTEXT_INTERCEPTOR_SECRET`),
`MAHA_COMPILER_URL`, and optionally `MAHA_GATEWAY_MAX_BODY_BYTES`,
`MAHA_GATEWAY_TIMEOUT_MS`, `MAHA_GATEWAY_MINIMUM_COMPILE_TOKENS`.

MIT licensed. Prerelease: `0.1.0`.
