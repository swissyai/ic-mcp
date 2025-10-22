# Real Compilation Implementation Plan

## 🎯 Goal
Replace regex pattern matching with ACTUAL compilation for Motoko validation.

## ✅ What We Verified

### moc Compiler Access
```bash
# Reliable path discovery
dfx cache show  # Returns: ~/.cache/dfinity/versions/0.20.1
moc_path = "$(dfx cache show)/moc"

# Validation command
moc --check file.mo
```

### Error Format (Parseable!)
```
file.mo:line.col-line.col: severity [CODE], message

Examples:
- /tmp/test.mo:5.5-5.12: type error [M0096], expression of type Nat cannot produce expected type Text
- /tmp/test.mo:3.5-3.20: type error [M0057], unbound variable unknownVariable
- /tmp/test.mo:3.14-4.5: info, this looks like an unintended function call, perhaps a missing ';'?
- /tmp/test.mo:1.6-1.16: warning [M0194], unused identifier standalone
```

### Exit Codes
- ✅ Valid code: exit 0, no stderr
- ❌ Invalid code: exit 1, stderr with errors

---

## 🔨 Implementation Strategy

### Phase 1: Motoko Real Compilation (High Value) 
**Effort:** 2-3 hours  
**Value:** Transforms the tool from "linter" to "compiler"

#### 1.1 Update validators/motoko.ts

**Current:** Pattern matching (150 lines)  
**New:** Subprocess execution (similar to candid.ts)

```typescript
// New approach
export async function validateMotoko(code: string): Promise<ValidationResult> {
  // 1. Check if moc is available
  const mocPath = await findMocPath();
  if (!mocPath) {
    return fallbackToPatternMatching(code); // Graceful degradation
  }

  // 2. Write code to temp file
  const tempFile = join(tmpdir(), `motoko-${Date.now()}.mo`);
  await writeFile(tempFile, code);

  // 3. Run moc --check
  try {
    await execAsync(`${mocPath} --check ${tempFile}`);
    return { valid: true, issues: [] };
  } catch (error) {
    // 4. Parse compiler errors
    const issues = parseMocErrors(error.stderr);
    return { valid: false, issues };
  } finally {
    await unlink(tempFile);
  }
}
```

#### 1.2 Implement findMocPath()

```typescript
async function findMocPath(): Promise<string | null> {
  try {
    // Try dfx cache first (most reliable)
    const cacheDir = execSync('dfx cache show', { encoding: 'utf-8' }).trim();
    const mocPath = join(cacheDir, 'moc');
    
    if (existsSync(mocPath)) {
      return mocPath;
    }
  } catch {
    // dfx not installed or errored
  }

  // Try PATH
  try {
    execSync('which moc');
    return 'moc'; // In PATH
  } catch {
    // moc not in PATH
  }

  return null; // Not found
}
```

#### 1.3 Implement parseMocErrors()

```typescript
interface MocError {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  severity: 'error' | 'warning' | 'info';
  code: string; // e.g., 'M0096'
  message: string;
}

function parseMocErrors(stderr: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Regex pattern for moc error format
  // Format: file:line.col-line.col: severity [CODE], message
  const errorPattern = /([^:]+):(\d+)\.(\d+)-(\d+)\.(\d+):\s+(error|warning|info)\s+\[([^\]]+)\],\s+(.+)/g;
  
  let match;
  while ((match = errorPattern.exec(stderr)) !== null) {
    const [_, file, startLine, startCol, endLine, endCol, severity, code, message] = match;
    
    issues.push({
      severity: severity as 'error' | 'warning' | 'info',
      line: parseInt(startLine),
      column: parseInt(startCol),
      message: message.trim(),
      code: code,
      docUrl: getMotokoDocUrl(code),
    });
  }
  
  // Multi-line error messages (continuation lines)
  // Some errors span multiple lines, need to handle those too
  
  return issues;
}
```

#### 1.4 Graceful Degradation

```typescript
// Keep pattern matching as fallback
async function fallbackToPatternMatching(code: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  
  // Add info message about compilation
  issues.push({
    severity: 'info',
    message: 'Using pattern-based validation. Install dfx for full compiler validation.',
    suggestion: 'Install dfx: sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"',
  });
  
  // Run existing pattern checks
  issues.push(...checkActorStructure(code));
  issues.push(...checkStableVariables(code));
  // ... etc
  
  return { valid: !issues.some(i => i.severity === 'error'), issues };
}
```

---

### Phase 2: Rust Real Compilation (Medium Value)
**Effort:** 4-6 hours (more complex)  
**Value:** Nice-to-have, less critical

**Challenges:**
- Needs Cargo.toml and project structure
- Dependency resolution (ic-cdk versions)
- Longer compile times

**Approach:**
```typescript
// Create temp cargo project
const projectDir = mkdtempSync('icp-rust-');
writeFileSync(join(projectDir, 'Cargo.toml'), CARGO_TEMPLATE);
writeFileSync(join(projectDir, 'src', 'lib.rs'), code);

// Run cargo check
execAsync('cargo check --manifest-path ${projectDir}/Cargo.toml');
```

**Decision:** Phase 2, not Phase 1. Focus on Motoko first.

---

## 📊 Value Comparison

| Validation Method | Motoko | Rust | Candid | dfx.json |
|-------------------|---------|------|--------|----------|
| **Current** | Regex ⭐⭐ | Regex ⭐⭐ | didc ⭐⭐⭐⭐⭐ | Schema ⭐⭐⭐⭐ |
| **After Phase 1** | moc ⭐⭐⭐⭐⭐ | Regex ⭐⭐ | didc ⭐⭐⭐⭐⭐ | Schema ⭐⭐⭐⭐ |
| **After Phase 2** | moc ⭐⭐⭐⭐⭐ | cargo ⭐⭐⭐⭐ | didc ⭐⭐⭐⭐⭐ | Schema ⭐⭐⭐⭐ |

---

## 🚀 Implementation Order

### Week 1: Motoko Real Compilation
1. ✅ Test moc locally (Done!)
2. Implement findMocPath() (30 min)
3. Implement parseMocErrors() (1 hour)
4. Update validateMotoko() (1 hour)
5. Test with various error scenarios (1 hour)
6. Update README with new capabilities (30 min)

**Total:** ~4 hours

### Week 2: Polish & Test
7. Dogfood with real projects (2 hours)
8. Fix edge cases (1 hour)
9. Add comprehensive tests (1 hour)
10. Update version to 0.3.0 (30 min)

**Total:** ~4.5 hours

### Week 3: (Optional) Rust Compilation
11. Design cargo project scaffolding
12. Implement validateRust with cargo check
13. Test and iterate

---

## 🎯 Success Criteria

**Before (Pattern Matching):**
```
❌ Missing stable var → warning (might be intentional)
❌ Type mismatch → not caught
❌ Undefined variable → not caught
❌ Syntax error → not caught
```

**After (Real Compilation):**
```
✅ Missing stable var → compiler decides (not us)
✅ Type mismatch → type error [M0096] with exact location
✅ Undefined variable → type error [M0057] with exact location
✅ Syntax error → parse error with exact location
```

---

## 📈 Impact on Value Proposition

**Current pitch:**
"Provides validation and docs for ICP development"

**New pitch:**
"Real Motoko compilation in Claude Code - catch errors before you even save the file"

**Difference:**
- Linter → Compiler
- Suggestions → Actual errors
- Nice-to-have → Must-have

---

## ⚠️ Risk Mitigation

### Risk: moc not installed
**Mitigation:** Fallback to pattern matching + helpful error

### Risk: Error parsing breaks on new moc versions
**Mitigation:** Generic fallback parser + version detection

### Risk: Import resolution fails
**Mitigation:** Phase 1 ignores imports, Phase 2 handles them

### Risk: Performance (subprocess overhead)
**Mitigation:** Caching + async execution

---

## 📝 Next Steps (Right Now)

1. Create new branch: `feature/real-compilation`
2. Implement findMocPath()
3. Implement parseMocErrors()
4. Update validators/motoko.ts
5. Test extensively
6. Merge and ship 0.3.0

**Ready to start?**
