/**
 * Help tool. Parameter lists are generated from the tools' own schemas, and
 * every example call in HELP_EXAMPLES is checked against those schemas in tests.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../utils/logger.js';
import { QueryInputSchema, QUERY_OPERATIONS } from './query.js';
import { OPERATIONS } from './action.js';
import { ExecuteInputSchema } from './execute.js';
import { REFS } from '../data/references.js';

export const HELP_SECTIONS = [
  'overview',
  'query',
  'action',
  'execute',
  'examples',
  'motoko',
  'deploy',
  'cloud-engine',
  'chat',
  'tokens',
  'all',
] as const;

export const HelpInputSchema = z.object({
  section: z
    .enum(HELP_SECTIONS)
    .optional()
    .default('overview')
    .describe('overview, query, action, execute, examples, motoko, deploy, cloud-engine (guide), chat (guide), tokens, all'),
});

export type HelpInput = z.infer<typeof HelpInputSchema>;

export interface HelpExample {
  tool: 'icp/query' | 'icp/action' | 'icp/execute' | 'icp/help';
  args: Record<string, any>;
  note: string;
}

export const HELP_EXAMPLES: Record<string, HelpExample[]> = {
  query: [
    { tool: 'icp/query', args: { operation: 'search', query: 'deploy to mainnet cycles' }, note: 'Rank official skills and docs pages' },
    { tool: 'icp/query', args: { operation: 'list-skills' }, note: 'All official skills with one-line summaries' },
    { tool: 'icp/query', args: { operation: 'skill', name: 'icp-cli' }, note: 'Outline: section ids, titles, sizes' },
    { tool: 'icp/query', args: { operation: 'skill', name: 'icp-cli', section: 'Common Pitfalls' }, note: 'One section by heading' },
    { tool: 'icp/query', args: { operation: 'skill', name: 'writing-motoko', query: 'null coalesce' }, note: 'The most relevant section' },
    {
      tool: 'icp/query',
      args: { operation: 'page', url: 'https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet.md', query: 'identity' },
      note: 'A section of a docs page',
    },
    { tool: 'icp/query', args: { operation: 'document', modules: ['Map', 'List'] }, note: 'mo:core signatures' },
    { tool: 'icp/query', args: { operation: 'examples', modules: ['Map'] }, note: 'Official Motoko code that imports mo:core/Map' },
    { tool: 'icp/query', args: { operation: 'fetch-icp-example', exampleId: 'http-get' }, note: 'Example project with converted icp.yaml' },
  ],
  action: [
    { tool: 'icp/action', args: { action: 'preflight', context: { projectPath: './my-app' } }, note: 'What is missing, and the next step' },
    { tool: 'icp/action', args: { action: 'new-project', context: { name: 'my-app', template: 'hello-world' } }, note: 'icp new' },
    { tool: 'icp/action', args: { action: 'network-start', context: { projectPath: './my-app' } }, note: 'icp network start -d' },
    { tool: 'icp/action', args: { action: 'deploy', context: { projectPath: './my-app' } }, note: 'Local deploy, mode auto' },
    {
      tool: 'icp/action',
      args: { action: 'call', context: { projectPath: './my-app', canister: 'backend', method: 'greet', args: '("World")', query: true } },
      note: 'Query call on the local network',
    },
    {
      tool: 'icp/action',
      args: { action: 'deploy', context: { projectPath: './my-app', environment: 'ic' } },
      note: 'Returns a mainnet plan; repeat with confirm: true after the user agrees',
    },
    {
      tool: 'icp/action',
      args: { action: 'deploy', context: { projectPath: './my-app', engine: 'my-engine' } },
      note: 'Cloud engine plan: icp deploy -e ic --engine my-engine',
    },
    { tool: 'icp/action', args: { action: 'convert-dfx', context: { projectPath: './legacy-app' } }, note: 'Preview icp.yaml from dfx.json' },
    {
      tool: 'icp/action',
      args: { action: 'validate', context: { code: 'actor { public query func hi() : async Text { "hi" } }', language: 'motoko' } },
      note: 'mops check with the latest moc',
    },
    { tool: 'icp/action', args: { action: 'lint-engine', context: { projectPath: './my-app' } }, note: 'Cloud engine call rules' },
    { tool: 'icp/action', args: { action: 'network-stop', context: { projectPath: './my-app' } }, note: 'icp network stop' },
  ],
  execute: [
    {
      tool: 'icp/execute',
      args: {
        code: "const r = await queryTool.execute({ operation: 'list-skills', format: 'json' }); return r.skills.filter(s => s.category === 'CloudEngine');",
      },
      note: 'Filter data before it reaches the model',
    },
  ],
};

type JsonSchema = { properties?: Record<string, any>; required?: string[] };

/** Render parameters of a zod object schema as a bullet list. */
export function describeSchema(schema: z.ZodTypeAny, skip: string[] = []): string {
  const json = zodToJsonSchema(schema, { $refStrategy: 'none' }) as JsonSchema;
  const required = new Set(json.required || []);
  const lines: string[] = [];
  for (const [name, prop] of Object.entries(json.properties || {})) {
    if (skip.includes(name)) continue;
    const type = prop.enum
      ? prop.enum.map((v: string) => JSON.stringify(v)).join(' | ')
      : prop.type === 'array'
        ? `${prop.items?.enum ? prop.items.enum.map((v: string) => JSON.stringify(v)).join(' | ') : prop.items?.type || 'any'}[]`
        : prop.type || (prop.anyOf ? prop.anyOf.map((p: any) => p.type).join(' | ') : 'any');
    lines.push(`- \`${name}\` (${type}${required.has(name) ? ', required' : ''})${prop.description ? `: ${prop.description}` : ''}`);
  }
  return lines.join('\n');
}

function renderExamples(key: string): string {
  return (HELP_EXAMPLES[key] || [])
    .map(e => `${e.note}:\n\`\`\`json\n${JSON.stringify({ tool: e.tool, arguments: e.args })}\n\`\`\``)
    .join('\n\n');
}

function overview(): string {
  return `# ic-mcp

Tools for building on the Internet Computer with icp-cli, backed by the official skills and docs.

Official guidance lives at ${REFS.skillsHome} (agents: fetch ${REFS.skillsLlms} and follow it). This server serves those skills and the icp-cli and developer docs one section at a time, and runs icp-cli and mops locally with plans and confirmations.

## Tools

- \`icp/query\`: search and read official skills, icp-cli docs and developer docs by section; mo:core signatures; example projects.
- \`icp/action\`: preflight, new-project, local network, deploy, call, status, dfx.json conversion, validation, cloud engine lint.
- \`icp/execute\`: run JavaScript that calls the two tools above and returns only what you need.
- \`icp/help\`: this text. Sections: ${HELP_SECTIONS.filter(s => s !== 'all').join(', ')}, all.

## Start

1. \`icp/action\` with action "preflight": installed tools, identity, project, and the next step.
2. \`icp/query\` with operation "search" before writing ICP code, then read the matching skill section.

## Safety

- Commands run as argument lists without a shell. Nothing wipes local state unless you pass mode "reinstall".
- Mainnet, cloud engine and other remote deploys, reinstalls, and remote update calls return a plan first and run only with \`context.confirm: true\`, after the user agrees.
- Remote deploys as the anonymous identity are refused.

## No terminal?

ChatGPT and Claude on the web or phone cannot run this local server. Use the official ICP MCP connector: section "chat".
`;
}

function queryHelp(): string {
  return `# icp/query

Operations: ${QUERY_OPERATIONS.join(', ')}.

- search: ranks skills (name, summary, keywords) and docs index entries for \`query\`. Each result has a \`next\` call.
- list-skills: the skills index (${REFS.skillsHome}).
- skill: without \`section\` or \`query\`, an outline of section ids, titles and sizes. With \`section\` (id like "4" or "4.2", or heading text) one section; with \`query\` the best-matching section plus other matches. \`file\` reads a skill reference file such as "references/examples.md".
- page: same for a page on cli.internetcomputer.org, docs.internetcomputer.org or skills.internetcomputer.org (\`url\`; ".md" is added when missing).
- list-all / document / examples: mo:core modules, their signatures, and official examples, from the writing-motoko skill.
- list-icp-examples / fetch-icp-example: example projects (written for dfx); fetch returns a converted icp.yaml.

Content is cached for an hour (IC_MCP_CACHE_TTL_SECONDS). Each result carries \`source.fetchedAt\` and \`source.stale\`; a stale copy comes with a warning. A redirect to another page, an HTML page where markdown was expected, or a 404 is reported as an error, never returned as content.

## Parameters

${describeSchema(QueryInputSchema)}

## Examples

${renderExamples('query')}
`;
}

function actionHelp(): string {
  const ops = Object.entries(OPERATIONS)
    .map(([id, spec]) => `### ${id}\n\n${spec.summary}\n\n${describeSchema(spec.schema)}`)
    .join('\n\n');
  return `# icp/action

Call with \`action\` set to an operation id and its parameters in \`context\`. A short phrase also works ("start the local network"), but mainnet and engines are never inferred from text.

## Confirmation

Deploys to mainnet, a cloud engine or another remote environment, \`mode: "reinstall"\`, \`acceptBreakingChange\`, and update calls outside the local network first return \`status: "confirmation-required"\` with the exact command and its effects. Show the plan to the user; run it by repeating the call with \`confirm: true\`.

## Operations

${ops}

## Examples

${renderExamples('action')}
`;
}

function executeHelp(): string {
  return `# icp/execute

Runs JavaScript in a separate Node vm context with \`queryTool.execute(args)\`, \`actionTool.execute(args)\`, \`helpers\` and an optional persistent \`workspace\`. Use it to filter or combine results before they reach the model. Pass \`format: "json"\` in tool arguments to get parsed objects.

The vm context is not a security boundary: code runs with this server's permissions, and \`actionTool\` can run the same operations as icp/action, including confirmed deploys.

## Parameters

${describeSchema(ExecuteInputSchema)}

## Example

${renderExamples('execute')}
`;
}

function examplesHelp(): string {
  return `# Workflows

## New app on the local network

1. \`icp/action\` preflight
2. \`icp/action\` new-project { name, template: "hello-world" }
3. \`icp/action\` deploy { projectPath } (starts the project network if needed)
4. \`icp/action\` call { canister, method, args, query }
5. \`icp/action\` network-stop when done

## Existing dfx project

1. \`icp/action\` convert-dfx { projectPath } to preview, then with write: true
2. \`icp/action\` analyze { projectPath }
3. \`icp/action\` deploy { projectPath }

## Writing Motoko

1. \`icp/query\` skill { name: "writing-motoko", query: "<topic>" }
2. \`icp/action\` validate { code, language: "motoko" } or { projectPath, canister } for a project
3. For a cloud engine: \`icp/action\` lint-engine { projectPath }

## Mainnet

1. \`icp/action\` preflight { target: "mainnet", checkMainnet: true }
2. \`icp/action\` deploy { environment: "ic" }: plan; then confirm: true

## Cloud engine

Section "cloud-engine".
`;
}

function motokoHelp(): string {
  return `# Motoko

The writing-motoko skill is the authority: ${REFS.writingMotoko}
Read it by section: \`icp/query\` { operation: "skill", name: "writing-motoko", query: "<topic>" }.

Rules this server checks or relies on, from that skill:

- Import from \`mo:core\`; \`mo:base\` is deprecated.
- Iterate with \`.values()\`; \`.vals()\` fails on core collections (M0072).
- Use dot notation for functions with a \`self\` parameter: \`list.add(x)\`, \`map.get(k)\`.
- Plain \`break\` and \`continue\` work in \`for\`, \`while\` and \`loop\`.
- Actor state persists under enhanced orthogonal persistence: no \`stable\` keyword, no \`system func preupgrade/postupgrade\`. State shape changes go through the mops-managed migration chain (${REFS.migratingMotokoActors}).
- Toolchain and dependencies live in mops.toml; check with \`mops check\`, build with \`mops build\` (${REFS.mopsCli}).

\`icp/action\` validate runs \`mops check\`: in a project with its mops.toml (projectPath), or for a snippet in a temporary project with the latest moc and mo:core.
`;
}

function deployHelp(): string {
  return `# Deploying with icp-cli

- Local: each project has its own network. \`network-start\` runs \`icp network start -d\`; \`deploy\` runs \`icp deploy -e local --json\` (mode auto: install new canisters, upgrade existing ones, keep state).
- Mainnet: \`deploy\` with \`environment: "ic"\` needs a named identity with cycles. Each new canister takes 2T cycles by default (\`cycles\`). Check with preflight { target: "mainnet", checkMainnet: true }. Fund by card with \`icp cycles buy\` (the user pays) or convert ICP with \`icp cycles mint\`.
- Cloud engine: \`deploy\` with \`engine\` (section "cloud-engine").
- A breaking Candid change stops the deploy. Pass \`acceptBreakingChange: true\` with \`confirm: true\` only when the user accepts it.
- Mainnet canister ids are stored in .icp/data/mappings/<environment>.ids.json: commit .icp/data/, ignore only .icp/cache/.

Reference: ${REFS.icpCli}
`;
}

function cloudEngineHelp(): string {
  return `# Guide: deploy to a cloud engine from Claude Code or Codex

For a coding agent on the user's own computer, with icp-cli. In a web or phone chat, use section "chat".

## 1. Install and check

\`\`\`bash
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops
\`\`\`

\`icp/action\` preflight { projectPath, target: "engine" }. \`--engine\` needs icp-cli 1.7 or later; older versions take the engine's subnet id with \`subnet\` (engine Settings page in the console).

## 2. Values from the user

- Console origin: default https://opencloud.org. Its host is the \`--app\` value.
- Engine name as shown in the console (\`name/slug\` or the engine id if names repeat).
- The proxy canister id, only if the app signs (threshold ECDSA/Schnorr), uses vetKD, the exchange-rate canister, the Bitcoin API or EVM/SOL RPC. The engine owner deploys it in the console: engine, Integrations, Proxy canisters.

## 3. Link the engine identity (once per machine)

\`\`\`bash
printf '\\n' | icp identity link web <name> --app opencloud.org
icp identity default <name>
icp identity principal
\`\`\`

The user finishes the Internet Identity sign-in in the browser that opens. On first use id.ai may show "CLI access disabled": turn on CLI access in the Internet Identity settings and run the link again. Without \`--app\`, or with another host, the principal differs and the engine rejects the deploy. The sign-in returns to 127.0.0.1 on the machine running icp, so the browser must be on that machine.

## 4. Engine code rules

\`icp/action\` lint-engine { projectPath } checks them. From ${REFS.cloudEngineCanisters}:

- Engine canisters hold 0 cycles. Never attach cycles to a call; any non-zero amount fails with IC0504.
- Cross-subnet calls must be bounded-wait: \`await (with timeout = 30) other.method(args)\` in Motoko, \`Call::bounded_wait\` in Rust. Calls between canisters on the same engine are exempt.
- HTTPS outcalls use the standard wrapper and cost nothing.
- Threshold signing, vetKD, the exchange-rate canister, the Bitcoin API and EVM/SOL RPC go through the console proxy canister; read its id from a PROXY_CANISTER_ID environment variable.

## 5. Name the app in the console (optional)

Set canister environment variables under \`settings.environment_variables\`: \`__META_PROJECT\` (same app name on every canister), \`__META_NAME\` (label), \`__META_MAIN_CANISTER: "true"\` on exactly one canister, and on that one \`__META_BASE_URL\` (https) and \`__META_ICON_PATH\`.

## 6. Deploy

\`icp/action\` deploy { projectPath, engine: "<name>" } returns the plan for \`icp deploy -e ic --engine <name> --json\`, with lint findings. After the user agrees, repeat with \`confirm: true\`.

## 7. Verify and report

The result lists canister ids. A frontend is served at https://<frontend-canister-id>.icp.net. The canisters appear on the engine's "Your apps and services" page.

## Billing

The engine balance pays for the engine and its console proxies. It is funded on the engine's Billing page; when it runs out the engine is deleted. It is not readable from the CLI. App canisters on the engine show 0 cycles by design.

Full skill: ${REFS.deployToCloudEngine}
`;
}

function chatHelp(): string {
  return `# Guide: ChatGPT or Claude chat with the official ICP MCP connector

ic-mcp is a local stdio server: it runs next to Claude Code, Codex or Cursor, not inside a web or phone chat. In ChatGPT or Claude chat, use DFINITY's hosted connector (${REFS.icpMcp}).

## Connect

- ChatGPT: install the plugin "Internet Computer (ICP)" by DFINITY Stiftung, then "Continue to Internet Computer (ICP)".
- Claude or another MCP-capable app: add a custom connector with URL ${REFS.icpMcpConnector}.
- Sign in with Internet Identity, choose how long the session lasts, and choose "Actions & questions" (needed for any state change) or "Questions only". Grants expire; reconnecting later is normal. Removing the connector revokes access.

For building guidance in the chat, ask the assistant to fetch ${REFS.skillsLlms} and follow it.

## Tools it provides

open_app, list_app_accounts, get_app_principal, get_canister_candid, get_canister_api_doc, get_canister_oql_schema, canister_query, icp_oql_guide, canister_update_call, candid_syntax_guide.

## Limits

- It reaches only canisters that an app declares in its /.well-known/ic-architecture manifest.
- It has no project scaffolding, compiler, build, local network or docs search.
- It acts as the user's Internet Identity principal for the app's origin. At a cloud engine that is the principal for the engine's platform domain, not the console principal, so the engine owner must invite it as a developer before it can deploy.
- Deploying to a cloud engine works only through the engine-operator canister's \`proxy\` method: it installs a wasm module, with arguments as binary Candid (the chat needs a code sandbox to encode them). Modules over about 2 MB go up in chunks.
- It cannot call the canister it installed, so it cannot upload the files of an asset canister. Apps with a frontend need the CLI route (section "cloud-engine").
- "Questions only" sessions are rejected on every state-changing call.

Full steps for the engine route: ${REFS.deployToCloudEngine} ("ICP MCP Route").
`;
}

function tokensHelp(): string {
  return `# Response size

- Skills run 20K to 65K characters. \`icp/query\` returns an outline first, then one section (default limit 6000 characters, \`maxChars\` up to 20000).
- \`format\`: "toon" (default) for structured lists, "json" for parsing in icp/execute, "markdown" for reading. Section content is returned as plain markdown.
- \`icp/execute\` filters large results before they reach the model.
`;
}

const SECTIONS: Record<Exclude<(typeof HELP_SECTIONS)[number], 'all'>, () => string> = {
  overview,
  query: queryHelp,
  action: actionHelp,
  execute: executeHelp,
  examples: examplesHelp,
  motoko: motokoHelp,
  deploy: deployHelp,
  'cloud-engine': cloudEngineHelp,
  chat: chatHelp,
  tokens: tokensHelp,
};

export async function help(input: HelpInput) {
  logger.info(`Help: ${input.section}`);
  const text =
    input.section === 'all'
      ? Object.values(SECTIONS)
          .map(render => render())
          .join('\n---\n\n')
      : SECTIONS[input.section]();
  return { content: [{ type: 'text' as const, text }] };
}

export const helpTool = {
  name: 'icp/help',
  description:
    'How to use these tools, generated from their schemas; guides for cloud engine deploys and for the official ICP MCP connector in ChatGPT or Claude chat.',
  inputSchema: HelpInputSchema,
  execute: help,
};
