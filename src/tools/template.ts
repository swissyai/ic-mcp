/**
 * MCP tool: icp/template
 * Generates boilerplate code for ICP projects
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Input schema
export const TemplateInputSchema = z.object({
  templateType: z
    .enum(['motoko-canister', 'rust-canister', 'full-project'])
    .describe('Type of template to generate'),
  name: z.string().describe('Project/canister name'),
  features: z
    .array(z.string())
    .optional()
    .describe('Optional features to include'),
});

export type TemplateInput = z.infer<typeof TemplateInputSchema>;

/**
 * Generate Motoko canister template
 */
function generateMotokoCanister(name: string, features: string[] = []): Record<string, string> {
  const hasStableVars = features.includes('stable-vars');
  const hasUpgradeHooks = features.includes('upgrade-hooks');
  const hasTimer = features.includes('timer');

  const mainMo = `${hasUpgradeHooks ? 'import Debug "mo:core/Debug";\n\n' : ''}persistent actor ${name} {
  ${hasStableVars ? `// Persistent state\n  var counter : Nat = 0;\n` : ''}
  ${hasTimer ? `\n  // Timer\n  system func timer(setGlobalTimer : Nat64 -> ()) : async () {\n    // Timer logic here\n    Debug.print("Timer fired");\n  };\n` : ''}
  // Query method (read-only)
  public query func getCount() : async Nat {
    ${hasStableVars ? 'counter' : '0'}
  };

  // Update method (modifies state)
  public func increment() : async Nat {
    ${hasStableVars ? 'counter += 1;\n    counter' : '1'}
  };
${hasUpgradeHooks ? `\n  // Upgrade hooks\n  system func preupgrade() {\n    Debug.print("Preparing to upgrade");\n  };\n\n  system func postupgrade() {\n    Debug.print("Upgrade complete");\n  };\n` : ''}}
`;

  const candidDid = `service : {
  getCount : () -> (nat) query;
  increment : () -> (nat);
}
`;

  const dfxJson = `{
  "canisters": {
    "${name}": {
      "type": "motoko",
      "main": "src/${name}/main.mo",
      "candid": "src/${name}/${name}.did"
    }
  },
  "defaults": {
    "build": {
      "args": "",
      "packtool": ""
    }
  },
  "version": 1
}
`;

  const readme = `# ${name}

Motoko canister template.

## Features

${hasStableVars ? '- Persistent state management\n' : ''}${hasUpgradeHooks ? '- Upgrade hooks (pre/post upgrade)\n' : ''}${hasTimer ? '- Timer functionality\n' : ''}- Query and update methods
- Candid interface

## Development

\`\`\`bash
# Start local replica
dfx start --clean

# Deploy canister
dfx deploy

# Call methods
dfx canister call ${name} getCount
dfx canister call ${name} increment
\`\`\`

## Upgrade

\`\`\`bash
# After making changes
dfx build ${name}
dfx canister install ${name} --mode upgrade
\`\`\`
`;

  return {
    [`src/${name}/main.mo`]: mainMo,
    [`src/${name}/${name}.did`]: candidDid,
    'dfx.json': dfxJson,
    'README.md': readme,
  };
}

/**
 * Generate Rust canister template
 */
function generateRustCanister(name: string, features: string[] = []): Record<string, string> {
  const hasState = features.includes('state-management');
  const hasUpgradeHooks = features.includes('upgrade-hooks');

  const libRs = `use ic_cdk::*;
${hasState ? 'use std::cell::RefCell;\n' : ''}
${hasState ? `thread_local! {\n    static COUNTER: RefCell<u64> = RefCell::new(0);\n}\n\n` : ''
    }#[query]
fn get_count() -> u64 {
    ${hasState ? 'COUNTER.with(|c| *c.borrow())' : '0'}
}

#[update]
fn increment() -> u64 {
    ${
      hasState
        ? 'COUNTER.with(|c| {\n        let mut count = c.borrow_mut();\n        *count += 1;\n        *count\n    })'
        : '1'
    }
}

#[init]
fn init() {
    ic_cdk::println!("${name} canister initialized");
}
${
  hasUpgradeHooks
    ? `\n#[pre_upgrade]\nfn pre_upgrade() {\n    ic_cdk::println!("Preparing upgrade");\n}\n\n#[post_upgrade]\nfn post_upgrade() {\n    ic_cdk::println!("Upgrade complete");\n}\n`
    : ''
}
ic_cdk::export_candid!();
`;

  const cargoToml = `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.13"
candid = "0.10"
`;

  const candidDid = `service : {
  get_count : () -> (nat64) query;
  increment : () -> (nat64);
}
`;

  const dfxJson = `{
  "canisters": {
    "${name}": {
      "type": "rust",
      "candid": "src/${name}/${name}.did",
      "package": "${name}"
    }
  },
  "defaults": {
    "build": {
      "args": "",
      "packtool": ""
    }
  },
  "version": 1
}
`;

  const readme = `# ${name}

Rust canister template using ic-cdk.

## Features

${hasState ? '- Thread-local state management with RefCell\n' : ''}${hasUpgradeHooks ? '- Upgrade hooks (pre/post upgrade)\n' : ''}- Query and update methods
- Candid export
- Type-safe operations

## Development

\`\`\`bash
# Start local replica
dfx start --clean

# Deploy canister
dfx deploy

# Call methods
dfx canister call ${name} get_count
dfx canister call ${name} increment
\`\`\`

## Testing

\`\`\`bash
cargo test
\`\`\`
`;

  return {
    [`src/${name}/src/lib.rs`]: libRs,
    [`src/${name}/Cargo.toml`]: cargoToml,
    [`src/${name}/${name}.did`]: candidDid,
    'dfx.json': dfxJson,
    'README.md': readme,
  };
}

/**
 * Generate full project template
 */
function generateFullProject(name: string): Record<string, string> {
  const motokoFiles = generateMotokoCanister(`${name}_backend`, ['stable-vars']);
  const dfxJson = `{
  "canisters": {
    "${name}_backend": {
      "type": "motoko",
      "main": "src/${name}_backend/main.mo",
      "candid": "src/${name}_backend/${name}_backend.did"
    },
    "${name}_frontend": {
      "type": "assets",
      "source": ["src/${name}_frontend/dist"],
      "frontend": {
        "entrypoint": "src/${name}_frontend/dist/index.html"
      },
      "dependencies": ["${name}_backend"]
    }
  },
  "defaults": {
    "build": {
      "args": "",
      "packtool": ""
    }
  },
  "version": 1
}
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>${name}</h1>
    <div id="app">
      <p>Count: <span id="count">0</span></p>
      <button id="increment">Increment</button>
    </div>
    <script type="module" src="index.js"></script>
  </body>
</html>
`;

  const indexJs = `import { ${name}_backend } from "../../declarations/${name}_backend";

async function updateCount() {
  const count = await ${name}_backend.getCount();
  document.getElementById("count").textContent = count;
}

document.getElementById("increment").addEventListener("click", async () => {
  await ${name}_backend.increment();
  updateCount();
});

updateCount();
`;

  const styleCss = `body {
  font-family: system-ui, sans-serif;
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
}

#app {
  margin-top: 30px;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
`;

  return {
    ...motokoFiles,
    'dfx.json': dfxJson,
    [`src/${name}_frontend/dist/index.html`]: indexHtml,
    [`src/${name}_frontend/dist/index.js`]: indexJs,
    [`src/${name}_frontend/dist/style.css`]: styleCss,
    'README.md': `# ${name}\n\nFull-stack Internet Computer project with Motoko backend and vanilla JS frontend.\n\n## Quick Start\n\n\`\`\`bash\ndfx start --clean\ndfx deploy\n\`\`\`\n\nThen open the frontend URL shown in the terminal.\n`,
  };
}

/**
 * Get template
 */
export async function template(input: TemplateInput) {
  const { templateType, name, features = [] } = input;

  logger.info(`Generating ${templateType} template: ${name}`);

  try {
    let files: Record<string, string>;

    switch (templateType) {
      case 'motoko-canister':
        files = generateMotokoCanister(name, features);
        break;

      case 'rust-canister':
        files = generateRustCanister(name, features);
        break;

      case 'full-project':
        files = generateFullProject(name);
        break;

      default:
        throw new Error(`Unsupported template type: ${templateType}`);
    }

    const instructions = [
      `1. Review generated files`,
      `2. Customize business logic in source files`,
      `3. Start local replica: dfx start --clean`,
      `4. Deploy: dfx deploy`,
      templateType === 'full-project' ? `5. Open frontend URL in browser` : '',
    ].filter(Boolean);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name,
              templateType,
              files,
              instructions,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('Template generation error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Failed to generate template: ${error.message}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
