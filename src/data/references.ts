/**
 * Links attached to diagnostics and guidance. Each points at a current page on
 * an official site; tests/live/official-sites.test.ts checks they resolve.
 */

export function skillPage(name: string): string {
  return `https://skills.internetcomputer.org/skills/${name}/`;
}

export const REFS = {
  skillsHome: 'https://skills.internetcomputer.org/',
  skillsLlms: 'https://skills.internetcomputer.org/llms.txt',
  writingMotoko: skillPage('writing-motoko'),
  reviewingMotoko: skillPage('reviewing-motoko'),
  migratingMotokoActors: skillPage('migrating-motoko-actors'),
  migratingToMoc2: skillPage('migrating-to-moc-2'),
  mopsCli: skillPage('mops-cli'),
  icpCli: skillPage('icp-cli'),
  canisterSecurity: skillPage('canister-security'),
  httpsOutcalls: skillPage('https-outcalls'),
  stableMemory: skillPage('stable-memory'),
  multiCanister: skillPage('multi-canister'),
  cloudEngineCanisters: skillPage('cloud-engine-canisters'),
  deployToCloudEngine: skillPage('deploy-to-cloud-engine'),
  cliDocs: 'https://cli.internetcomputer.org/',
  icpYamlReference: 'https://cli.internetcomputer.org/1.8/reference/configuration/',
  migrationFromDfx: 'https://cli.internetcomputer.org/1.8/migration/from-dfx/',
  candidGuide: 'https://docs.internetcomputer.org/guides/canister-calls/candid/',
  icDid: 'https://docs.internetcomputer.org/references/ic.did',
  securityOverview: 'https://docs.internetcomputer.org/guides/security/overview/',
  securityAccess: 'https://docs.internetcomputer.org/guides/security/identity-and-access-management/',
  securityDos: 'https://docs.internetcomputer.org/guides/security/dos-prevention/',
  securityUpgrades: 'https://docs.internetcomputer.org/guides/security/canister-upgrades/',
  securityInterCanister: 'https://docs.internetcomputer.org/guides/security/inter-canister-calls/',
  securityOutcalls: 'https://docs.internetcomputer.org/guides/security/https-outcalls/',
  httpsOutcallsGuide: 'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
  icpMcp: 'https://mcp.internetcomputer.org/',
  icpMcpConnector: 'https://mcp.internetcomputer.org/mcp',
  candidRepo: 'https://github.com/dfinity/candid',
} as const;
