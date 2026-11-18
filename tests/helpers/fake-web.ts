/**
 * In-memory stand-in for the official documentation sites, shaped like the
 * real responses: markdown and JSON with their content types, HTML for missing
 * pages, and a legacy URL that redirects to the docs home page.
 */

import { setFetchImplementation, clearDocumentCache, type FetchLike, type FetchLikeResponse } from '../../src/fetchers/official.js';

const SKILLS = 'https://skills.internetcomputer.org/.well-known/agent-skills';

export const SKILL_INDEX = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [
    {
      name: 'icp-cli',
      type: 'archive',
      description: 'Guides use of the icp command-line tool for building and deploying Internet Computer applications.',
      url: `${SKILLS}/icp-cli.zip`,
      files: ['SKILL.md', 'references/dfx-migration.md'],
    },
    {
      name: 'writing-motoko',
      type: 'archive',
      description: 'Motoko language pitfalls, modern syntax, and architecture patterns.',
      url: `${SKILLS}/writing-motoko.zip`,
      files: ['SKILL.md', 'references/api-reference.md', 'references/examples.md'],
    },
    {
      name: 'cloud-engine-canisters',
      type: 'skill-md',
      description: 'Rules for canister code on a cloud engine. Engine canisters hold 0 cycles.',
      url: `${SKILLS}/cloud-engine-canisters/SKILL.md`,
      files: ['SKILL.md'],
    },
  ],
};

export const SKILL_CATALOG = {
  count: 3,
  skills: [
    { name: 'icp-cli', title: 'ICP CLI', category: 'Infrastructure', summary: 'Build, deploy and manage IC projects with the icp CLI and icp.yaml.', keywords: ['deploy', 'icp.yaml', 'mainnet'] },
    { name: 'writing-motoko', title: 'Writing Motoko', category: 'Motoko', summary: 'Write correct modern Motoko.', keywords: ['Motoko', 'mo:core'] },
    { name: 'cloud-engine-canisters', title: 'Cloud Engine Canisters', category: 'CloudEngine', summary: 'Rules for canister code running on a cloud engine.', keywords: ['cloud engine', 'bounded wait', 'cycles'] },
  ],
};

export const ICP_CLI_SKILL = `---
name: icp-cli
description: "Guides use of the icp command-line tool."
metadata:
  title: ICP CLI
---

# ICP CLI

## What This Is

The \`icp\` command-line tool builds and deploys applications on the Internet Computer.

## Common Pitfalls

1. **Using \`--network ic\` to deploy to mainnet.** Use \`-e ic\`.

\`\`\`yaml
# not a heading inside a fence
## also not a heading
canisters:
  - name: backend
\`\`\`

### Identities on mainnet

Before deploying to mainnet, switch to a named identity with icp identity default.

### Local networks

Local networks are per project: run icp network start -d.

## Configuration

Recipes must be pinned to a version.
`;

export const WRITING_MOTOKO_SKILL = `---
name: writing-motoko
description: "Motoko language pitfalls."
compatibility: "moc >= 1.16.0, core >= 2.6.0, mops >= 3.0.0"
---

# Writing Motoko

## Critical Requirements

Never use the stable keyword. Plain break and continue work.

## Null Coalesce

Use \`??\` with a space on both sides for unwrap-or-default.

## Collections

\`\`\`motoko
import Map "mo:core/Map";
import Nat "mo:core/Nat";

let users = Map.empty<Nat, Text>();
users.add(1, "a");
\`\`\`
`;

export const API_REFERENCE = `# Core Library API Reference

Complete API signatures from \`mo:core\` library.

## List

- \`func add<T>(self : List<T>, element : T)\`
- \`func values<T>(self : List<T>) : Types.Iter<T>\`

## Map

- \`func add<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K, value : V)\`
- \`func get<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K) : ?V\`
`;

export const EXAMPLES = `# Motoko Development Examples

## Map Examples

\`\`\`motoko project=demo filepath=src/backend/main.mo
import Map "mo:core/Map";
import Nat "mo:core/Nat";
\`\`\`

### Complex Key Types

\`\`\`motoko
import Map "mo:core/Map";
import Text "mo:core/Text";

let byName = Map.empty<Text, Nat>();
\`\`\`

## Timer Example

\`\`\`motoko
import Timer "mo:core/Timer";
\`\`\`
`;

export const CLI_LLMS = `# ICP CLI Documentation (v1.8)
> Command-line tool for developing and deploying applications on the Internet Computer Protocol (ICP).
## Guides
- [Deploying to IC Mainnet](https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet.md): Set up an identity, obtain cycles, and deploy canisters to the Internet Computer mainnet.
- [Local Development](https://cli.internetcomputer.org/1.8/guides/local-development.md): Day-to-day edit-build-deploy workflow on a local ICP network.
## Reference
- [\`icp deploy\`](https://cli.internetcomputer.org/1.8/reference/cli/deploy.md): Deploy a project to an environment
`;

export const DOCS_LLMS = `# ICP Developer Docs
## Backends
- [Timers](https://docs.internetcomputer.org/guides/backends/timers.md): Schedule one-shot and periodic tasks in your canister
- [HTTPS outcalls](https://docs.internetcomputer.org/guides/backends/https-outcalls.md): Make HTTP GET and POST requests from canisters to external web APIs
`;

export const MAINNET_GUIDE = `# Deploying to IC Mainnet

## Set up an identity

Create an identity with icp identity new and select it with icp identity default.

## Get cycles

Buy cycles with icp cycles buy, or convert ICP with icp cycles mint.

## Deploy

Run icp deploy -e ic.
`;

const HOME_HTML = '<!doctype html><html><head><title>ICP Developer Docs</title></head><body><h1>Create AIware software on network cloud</h1></body></html>';

interface Route {
  status?: number;
  type: string;
  body: string;
  redirectTo?: string;
}

export function defaultRoutes(): Record<string, Route> {
  return {
    'https://skills.internetcomputer.org/.well-known/agent-skills/index.json': { type: 'application/json; charset=utf-8', body: JSON.stringify(SKILL_INDEX) },
    'https://skills.internetcomputer.org/api/skills.json': { type: 'application/json; charset=utf-8', body: JSON.stringify(SKILL_CATALOG) },
    [`${SKILLS}/icp-cli/SKILL.md`]: { type: 'text/markdown; charset=utf-8', body: ICP_CLI_SKILL },
    [`${SKILLS}/writing-motoko/SKILL.md`]: { type: 'text/markdown; charset=utf-8', body: WRITING_MOTOKO_SKILL },
    [`${SKILLS}/writing-motoko/references/api-reference.md`]: { type: 'text/markdown; charset=utf-8', body: API_REFERENCE },
    [`${SKILLS}/writing-motoko/references/examples.md`]: { type: 'text/markdown; charset=utf-8', body: EXAMPLES },
    'https://cli.internetcomputer.org/llms.txt': { type: 'text/plain', body: CLI_LLMS },
    'https://docs.internetcomputer.org/llms.txt': { type: 'text/plain', body: DOCS_LLMS },
    'https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet.md': { type: 'text/markdown', body: MAINNET_GUIDE },
    'https://internetcomputer.org/docs/motoko/core/List': { type: 'text/html', body: HOME_HTML, redirectTo: 'https://docs.internetcomputer.org/' },
    'https://docs.internetcomputer.org/': { type: 'text/html', body: HOME_HTML },
  };
}

export interface FakeWeb {
  routes: Record<string, Route>;
  requests: string[];
  offline: boolean;
  restore: () => void;
}

/** Install the fake web. Unknown URLs answer 404 with an HTML page, as the real sites do. */
export function installFakeWeb(routes: Record<string, Route> = defaultRoutes()): FakeWeb {
  clearDocumentCache();
  const state: FakeWeb = { routes, requests: [], offline: false, restore: () => {} };
  const fake: FetchLike = async url => {
    state.requests.push(url);
    if (state.offline) {
      throw new Error('getaddrinfo ENOTFOUND');
    }
    const route = state.routes[url];
    const finalRoute = route?.redirectTo ? state.routes[route.redirectTo] || route : route;
    const finalUrl = route?.redirectTo || url;
    const status = route ? (finalRoute.status ?? 200) : 404;
    const response: FetchLikeResponse = {
      ok: status >= 200 && status < 300,
      status,
      url: finalUrl,
      redirected: Boolean(route?.redirectTo),
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? (route ? finalRoute.type : 'text/html') : null) },
      text: async () => (route ? finalRoute.body : '<!doctype html><html><body>Not found</body></html>'),
    };
    return response;
  };
  const previous = setFetchImplementation(fake);
  state.restore = () => {
    setFetchImplementation(previous);
    clearDocumentCache();
  };
  return state;
}
