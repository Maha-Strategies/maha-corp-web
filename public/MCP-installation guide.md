# Adding the Maha Strategies Cognitive Defense Grid to Claude

## The Baseline
The Maha Strategies MCP server grants your local Claude instance real-time access to our "Cognitive Defense Grid." By integrating this tool, you can instruct Claude to audit your current cloud architecture, evaluate local inference workflows, and retrieve protocols for Zero-Payload infrastructure directly from the *Maha Principle* frameworks.

## Installation (Claude Desktop)
We route our canonical Model Context Protocol (MCP) through Smithery. To wire the sovereign baseline into your local Claude Desktop app, open your `claude_desktop_config.json` file and append the following configuration:

\`\`\`json
{
  "mcpServers": {
    "maha-cognitive-grid": {
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "maha-strategies-mcp",
        "--endpoint",
        "https://mcp.maha-os.com/mcp/sse"
      ]
    }
  }
}
\`\`\`

*Note: This connects you directly to our canonical SSE relay at `mcp.maha-os.com`.*

## The Execution (Test Prompt)
Once installed and your Claude Desktop restarts, the server will silently initialize. To verify the connection, feed Claude this exact prompt:

> **"Query the Maha Strategies tool. Audit a standard hyper-centralized cloud AI infrastructure against the Maha Protocol. What is the primary vulnerability, and what is the Zero-Payload alternative?"**

Claude will securely hit the endpoint, pull the doctrine, and output a structural teardown of centralized data liability versus on-device biological sovereignty.

---
**Documentation & Architecture:** [mahastrategies.com](https://www.mahastrategies.com)