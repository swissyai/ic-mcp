# v0.4.0: Project-Level Context Implementation Plan

## Goal
Enable Claude to understand entire ICP projects, not just code snippets.

## New Tool: icp/analyze-project

### Input
```typescript
{
  "projectPath": "/path/to/project",  // Optional, defaults to cwd
  "validate": true,                    // Run validation on all canisters
  "checkDependencies": true           // Analyze canister dependencies
}
```

### Output
```typescript
{
  "project": {
    "name": "my_dapp",
    "dfxVersion": "0.20.1",
    "canisters": [
      {
        "name": "backend",
        "type": "motoko",
        "main": "src/backend/main.mo",
        "dependencies": ["database"],
        "candid": "src/backend/backend.did",
        "files": ["main.mo", "types.mo"],
        "linesOfCode": 245
      }
    ],
    "networks": ["local", "ic"],
    "issues": [
      {
        "severity": "error",
        "message": "Circular dependency detected: backend -> database -> backend",
        "canisters": ["backend", "database"]
      }
    ]
  },
  "validation": {
    "backend": { valid: true, issues: [] },
    "database": { valid: false, issues: [...] }
  }
}
```

## Implementation Steps (6 hours)

### 1. Create Project Parser (2 hours)
**File:** `src/analyzers/project.ts`

```typescript
export interface ProjectStructure {
  name: string;
  path: string;
  dfxConfig: DfxConfig;
  canisters: CanisterInfo[];
  issues: ProjectIssue[];
}

export async function analyzeProject(projectPath: string): Promise<ProjectStructure> {
  // 1. Read dfx.json
  // 2. Parse canister configs
  // 3. Find all source files
  // 4. Detect dependencies
  // 5. Identify issues
}
```

**Verification:**
- Parse real dfx.json files
- Correctly identify all canisters
- Map source file locations

### 2. Dependency Graph Analysis (1.5 hours)
**File:** `src/analyzers/dependencies.ts`

```typescript
export interface DependencyGraph {
  nodes: CanisterNode[];
  edges: DependencyEdge[];
  cycles: string[][];  // Circular dependencies
}

export function buildDependencyGraph(project: ProjectStructure): DependencyGraph {
  // Parse imports in Motoko files
  // Parse dependencies in Rust Cargo.toml
  // Build graph
  // Detect cycles using DFS
}
```

**Verification:**
- Detect import statements
- Find circular dependencies
- Generate valid dependency order

### 3. Full Project Validation (1.5 hours)
**File:** `src/tools/analyze-project.ts`

```typescript
export async function analyzeProjectTool(input: AnalyzeProjectInput) {
  const project = await analyzeProject(input.projectPath);
  
  if (input.validate) {
    // Validate each canister
    for (const canister of project.canisters) {
      const code = await readFile(canister.main);
      const result = await validate({ code, language: canister.type });
      // Store results
    }
  }
  
  if (input.checkDependencies) {
    const graph = buildDependencyGraph(project);
    // Check for cycles, missing deps, etc.
  }
  
  return formatProjectAnalysis(project);
}
```

**Verification:**
- Run on real ICP projects
- Validate all canisters correctly
- Detect all dependency issues

### 4. Testing (1 hour)

Create test projects:
```bash
# Test project 1: Simple counter
test-projects/counter/
  ├── dfx.json
  └── src/
      └── counter/
          └── main.mo

# Test project 2: Multi-canister with deps
test-projects/dapp/
  ├── dfx.json
  └── src/
      ├── backend/main.mo
      ├── database/storage.mo
      └── frontend/

# Test project 3: Circular dependency (should fail)
test-projects/circular/
  ├── dfx.json
  └── src/
      ├── canister_a/main.mo (imports canister_b)
      └── canister_b/main.mo (imports canister_a)
```

**Verification Checklist:**
- [ ] Correctly parses all test projects
- [ ] Detects circular dependency in test 3
- [ ] Validates all canisters
- [ ] Returns complete project structure
- [ ] Handles missing files gracefully
- [ ] Works with both Motoko and Rust canisters

## Success Criteria

**Must Have:**
✅ Parse dfx.json and extract all canister configs
✅ Read all source files for each canister
✅ Validate all canisters if requested
✅ Detect circular dependencies
✅ Return structured project analysis

**Nice to Have:**
⭐ Import graph visualization
⭐ Code complexity metrics
⭐ Upgrade compatibility checks

## Estimated Time
- Implementation: 5 hours
- Testing: 1 hour
- **Total: 6 hours**

## Next Session Goals
1. Implement project parser
2. Build dependency analyzer
3. Create test projects
4. Verify on real project
5. Ship v0.4.0

---

**After v0.4.0, we can tackle:**
- v0.5.0: Playground deployment (test projects end-to-end)
- v0.6.0: Live canister analysis (debug production)
