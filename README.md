# IC-MCP

MCP server for building on the Internet Computer with icp-cli: official guidance by section, local toolchain operations with confirmations, dfx.json conversion, and Motoko checks through mops.

Official guidance for agents lives at [skills.internetcomputer.org](https://skills.internetcomputer.org/). This server reads it, it does not replace it. For ChatGPT or Claude chat without a terminal, see [Chat apps](#chat-apps-chatgpt-claude).

## Install

```bash
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops
```

Claude Code:

```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

Codex:

```bash
codex mcp add ic-mcp -- npx -y ic-mcp
```

Cursor:

```json
{
  "mcpServers": {
    "ic-mcp": { "command": "npx", "args": ["-y", "ic-mcp"] }
  }
}
```

Requires Node.js 22+ (icp-cli requires it). `didc` is optional, for Candid validation.

## Tools

| Tool | Purpose |
|------|---------|
| `icp/query` | Search and read official skills, icp-cli docs and developer docs one section at a time; mo:core signatures; example projects |
| `icp/action` | preflight, new-project, network-start/stop/status, deploy, call, status, convert-dfx, validate, lint-engine, analyze, check-upgrade, generate-tests, refactor |
| `icp/execute` | Run JavaScript that calls the two tools above and returns only what is needed |
| `icp/help` | Parameters generated from the schemas, workflows, guides |

Some clients show the names as `icp_query`, `icp_action`, `icp_execute`, `icp_help`; both forms are accepted.

## Usage

```json
{ "tool": "icp/action", "arguments": { "action": "preflight", "context": { "projectPath": "./my-app" } } }
{ "tool": "icp/query", "arguments": { "operation": "skill", "name": "writing-motoko", "query": "null coalesce" } }
{ "tool": "icp/action", "arguments": { "action": "deploy", "context": { "projectPath": "./my-app" } } }
{ "tool": "icp/action", "arguments": { "action": "convert-dfx", "context": { "projectPath": "./legacy-app", "write": true } } }
```

- `icp/query` returns an outline first, then one section. Content is cached for an hour (`IC_MCP_CACHE_TTL_SECONDS`) and marked when stale. A redirect, an HTML page where markdown was expected, or a 404 is an error, never content.
- `validate` runs `mops check` with the project's own toolchain (`projectPath`), or for a snippet with the latest moc and mo:core.
- `convert-dfx` writes icp.yaml and mops.toml entries; it previews unless `write: true` and never deletes dfx.json.

## Safety

- Commands run as argument arrays, without a shell.
- Nothing wipes state by default. Deploys use mode `auto` and the local network is never started clean.
- Deploys to mainnet, a cloud engine or another remote environment, `reinstall`, skipping the Candid compatibility check, and update calls outside the local network return a plan with the exact command first. They run only with `confirm: true`, after the user agrees.
- Remote deploys as the anonymous identity are refused.
- `icp/execute` runs code in a Node vm context, which is not a security boundary.

## Cloud engine from Claude Code or Codex

1. Check the setup: `preflight` with `{ "target": "engine" }`. `--engine` needs icp-cli 1.7 or later.
2. Ask the user for the engine name shown in the console at https://opencloud.org.
3. Link the identity that administers the engine, once per machine. The user completes the Internet Identity sign-in in the browser that opens; the browser must run on the same machine as `icp`.

   ```bash
   printf '\n' | icp identity link web <name> --app opencloud.org
   icp identity default <name>
   icp identity principal
   ```

4. Check the code: `lint-engine` with `{ "projectPath": "." }`. Engine canisters hold 0 cycles and must not attach cycles to calls; cross-subnet calls must be bounded-wait (`(with timeout = N)`, `Call::bounded_wait`); threshold signing, vetKD, the exchange-rate canister, the Bitcoin API and EVM/SOL RPC go through the engine's proxy canister.
5. Deploy: `deploy` with `{ "engine": "<name>" }` returns the plan for `icp deploy -e ic --engine <name> --json`. Repeat with `"confirm": true` once the user agrees.
6. Report the canister ids. A frontend is served at `https://<frontend-canister-id>.icp.net`.

The engine balance is funded on the engine's Billing page; when it runs out the engine is deleted. It is not readable from the CLI. Full steps: `icp/help` section `cloud-engine`, and the [deploy-to-cloud-engine](https://skills.internetcomputer.org/skills/deploy-to-cloud-engine/) skill.

## Chat apps (ChatGPT, Claude)

This server runs locally over stdio, so it is not available in web or phone chats. Use DFINITY's hosted connector instead:

- ChatGPT: install the plugin "Internet Computer (ICP)" by DFINITY Stiftung.
- Claude or another MCP-capable app: add a custom connector with URL `https://mcp.internetcomputer.org/mcp`.
- Sign in with Internet Identity, pick the session length, and pick "Actions & questions" (needed for any change) or "Questions only".

For building guidance in the chat, ask the assistant to fetch `https://skills.internetcomputer.org/llms.txt` and follow it.

Limits of the connector:

- It reaches only canisters an app declares in `/.well-known/ic-architecture`.
- It has no scaffolding, compiler, build, local network or docs search.
- On a cloud engine it can install a wasm through the engine-operator's `proxy` method, after the engine owner invites the connector's principal as a developer. Arguments are binary Candid, and modules over about 2 MB go up in chunks.
- It cannot call the canister it installed, so it cannot upload frontend assets. Apps with a frontend need the CLI route above.

Details: `icp/help` section `chat`, and https://mcp.internetcomputer.org/.

## Upgrading from 0.13

0.14 runs icp-cli instead of dfx and reads guidance from the official sites.

- Install the toolchain: `npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops`. dfx is not run.
- Projects build and deploy from `icp.yaml`. Convert a dfx project with `convert-dfx`.
- `deploy` defaults to mode `auto`: new canisters are installed, existing ones upgraded, state kept. `reinstall` returns a plan and needs `confirm: true`.
- Deploys to mainnet, a cloud engine or another remote environment, and update calls outside the local network, need `confirm: true`.
- `environment` (`local`, `ic`, or one from `icp.yaml`) replaces `network`. `network: "playground"` is rejected.
- `test` is now `call`. The old name and the `canisterId`, `mode` and `network` fields are still accepted.
- Motoko `validate` runs `mops check`. A snippet check downloads the latest moc on first use.
- `refactor` applies `add-caller-checks` only. `add-upgrade-hooks` and `add-stable-vars` return the current persistence guidance, since actor state persists without them.
- `icp/query` reads skills.internetcomputer.org, cli.internetcomputer.org and docs.internetcomputer.org. `document` and `examples` for mo:core come from the writing-motoko skill.
- `preflight` compares installed tool versions with the npm registry. Pass `checkLatest: false` to skip the lookup.
- New actions: `preflight`, `new-project`, `network-start`, `network-stop`, `network-status`, `status`, `convert-dfx`, `lint-engine`.

## Development

```bash
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp
npm install
npm run build
npm test
```

`npm test` uses fixtures and a recording command runner; it needs no network or toolchain. `IC_MCP_LIVE=1 npm test` also checks the official sites and links.

## Links

- [ICP skills](https://skills.internetcomputer.org/)
- [icp-cli docs](https://cli.internetcomputer.org/)
- [ICP developer docs](https://docs.internetcomputer.org/)
- [ICP MCP connector](https://mcp.internetcomputer.org/)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Examples repository](https://github.com/swissyai/ic-mcp-examples)

MIT License
