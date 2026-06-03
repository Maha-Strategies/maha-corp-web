# Connecting the Maha Cognitive Gateway to Claude

The Cognitive Gateway is the Maha Strategies Model Context Protocol (MCP) server,
published on Smithery as `mayone/cognitive-gateway`. Once connected, it gives
Claude tools for evaluating local-inference workflows and retrieving
Zero-Payload infrastructure protocols.

This guide uses the Smithery CLI — the connection method Smithery recommends for
this server.

> **Before you start:** This is an early-stage server. Connection takes a few CLI
> steps (it is not yet a one-click install), and current uptime is roughly 86%.
> If a call fails, retry or check the server status on Smithery before assuming
> your setup is wrong.

## Prerequisites
- Node.js and npm installed (the CLI is an npm package).
- A Smithery account and an API key (created from the server's Integrate tab).
- Claude Desktop, or another MCP-compatible client.

## 1. Install the Smithery CLI
Smithery brokers the connection and handles OAuth, token refresh, and session
management for you.

```bash
npm install -g smithery
```

## 2. Create an API key & namespace
Create an API key from the Cognitive Gateway's Integrate tab on Smithery
(https://smithery.ai/servers/mayone/cognitive-gateway), then create a namespace
(substitute your own name):

```bash
smithery namespace create your-namespace
```

## 3. Add the server
```bash
smithery mcp add mayone/cognitive-gateway
```

Follow any authentication prompt Smithery shows. This links the server to your
client through Smithery's managed connection.

## 4. Verify it connected
List the tools from the CLI:

```bash
smithery tool list your-connection
```

In Claude Desktop, you should also see the Cognitive Gateway's tools appear (look
for the tools/connector indicator in a new conversation). If they are not there,
restart the client, then see Troubleshooting.

## 5. Test prompt
With the tools loaded, give Claude this prompt to exercise the connection:

> "Use the Cognitive Gateway tool to evaluate a standard centralized cloud-AI
> setup against the Zero-Payload approach. What is the main data-exposure risk,
> and what is the on-device alternative?"

If connected, Claude will call the tool and return a structured comparison. If it
answers from general knowledge without invoking the tool, the connection is not
active — see Troubleshooting.

## 6. Troubleshooting
- **Tools don't appear in Claude:** fully quit and reopen the client — MCP servers
  are loaded at startup.
- **Auth errors:** confirm your Smithery API key is valid and that the `add` step
  finished its login prompt. Re-run the add step if needed.
- **Calls fail intermittently:** the server runs at ~86% uptime; check live status
  on the Smithery page and retry before changing your config.
- **Command not found:** verify Node/npm are installed and that the global npm bin
  directory is on your PATH.

---
**Server:** https://smithery.ai/servers/mayone/cognitive-gateway
**Documentation:** https://www.mahastrategies.com/research/mcp
