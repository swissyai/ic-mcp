# moc Compiler Integration: Edge Cases & Test Plan

## 🔬 Discovery Phase Results

### ✅ What We Learned

#### 1. Error Message Formats

**Single-line errors:**
```
file.mo:5.5-5.15: type error [M0057], unbound variable unknownVar
```

**Multi-line errors (common for type mismatches):**
```
file.mo:4.20-4.21: type error [M0096], expression of type
  Nat
cannot produce expected type
  Text
```

**Pattern:**
- Line 1: `file:line.col-line.col: severity [CODE], message`
- Lines 2+: Continuation (indented with 2 spaces)
- Blank line separates errors

#### 2. Error Severity Levels
- `error` - Compilation fails
- `warning` - Compilation succeeds but with warnings
- `info` - Informational messages (e.g., "this looks like missing semicolon")

#### 3. Exit Codes
- `0` - Valid code (no errors)
- `1` - Invalid code (has errors)

#### 4. Multiple Errors
moc reports ALL errors in one run:
```
file.mo:5.5-5.15: type error [M0057], unbound variable unknownVar
file.mo:9.5-9.12: type error [M0050], literal of type
  Text
does not have expected type
  Nat
```

#### 5. Import Resolution
**Without package flag:**
```bash
moc --check file.mo
# ❌ import error [M0010], package "base" not defined
```

**With package flag:**
```bash
moc --check --package base ~/.cache/dfinity/versions/0.20.1/base file.mo
# ✅ Works!
```

**Key discovery:** We need to pass `--package` for any imports to work.

---

## 🎯 Comprehensive Test Scenarios

### Test Suite Design

```typescript
describe('Motoko Real Compilation', () => {
  
  // CATEGORY 1: Basic Validation
  describe('Basic Validation', () => {
    it('validates empty actor', async () => {
      const code = 'actor {}';
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('validates simple counter actor', async () => {
      const code = `
        actor {
          stable var counter : Nat = 0;
          public query func get() : async Nat { counter };
          public func increment() : async () { counter += 1 };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true);
    });

    it('validates shared context pattern', async () => {
      const code = `
        actor {
          public shared(msg) func getCaller() : async Principal {
            msg.caller
          };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true);
    });
  });

  // CATEGORY 2: Type Errors
  describe('Type Errors', () => {
    it('catches type mismatch', async () => {
      const code = `
        actor {
          public func test() : async Text {
            5  // Returns Nat but expects Text
          };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toMatchObject({
        severity: 'error',
        code: 'M0096',
        line: 4,
        column: expect.any(Number),
        message: expect.stringContaining('cannot produce expected type'),
      });
    });

    it('catches unbound variable', async () => {
      const code = `
        actor {
          public func test() : async Nat {
            unknownVar
          };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toMatchObject({
        severity: 'error',
        code: 'M0057',
        message: expect.stringContaining('unbound variable'),
      });
    });

    it('reports multiple errors', async () => {
      const code = `
        actor {
          public func test1() : async Nat { unknownVar };
          public func test2() : async Text { 42 };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // CATEGORY 3: Syntax Errors
  describe('Syntax Errors', () => {
    it('catches missing semicolon', async () => {
      const code = `
        actor {
          public func test() : async Nat {
            let x = 5
            x
          }
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      // May have helpful info message about semicolon
    });

    it('catches invalid syntax', async () => {
      const code = 'actor { public func "invalid-name"() : async Nat { 42 }; }';
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      expect(result.issues[0].code).toBe('M0001'); // syntax error
    });
  });

  // CATEGORY 4: Import Handling
  describe('Import Handling', () => {
    it('validates code with base imports when package provided', async () => {
      const code = `
        import Debug "mo:base/Debug";
        actor {
          public func test() : async () {
            Debug.print("hello");
          };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true);
    });

    it('reports import error when package not found', async () => {
      const code = `
        import Nonexistent "mo:nonexistent/Module";
        actor {}
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toMatchObject({
        severity: 'error',
        code: 'M0010',
        message: expect.stringContaining('package'),
      });
    });
  });

  // CATEGORY 5: Edge Cases
  describe('Edge Cases', () => {
    it('handles empty file', async () => {
      const code = '';
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true); // Empty passes
    });

    it('handles unicode in strings', async () => {
      const code = `
        actor {
          let message = "Hello 世界 🌍";
          public func greet() : async Text { message };
        }
      `;
      const result = await validateMotoko(code);
      expect(result.valid).toBe(true);
    });

    it('handles very long error messages', async () => {
      // Some moc errors can be verbose
      const code = 'invalid syntax here ';
      const result = await validateMotoko(code);
      expect(result.issues[0].message.length).toBeGreaterThan(0);
    });
  });

  // CATEGORY 6: Fallback Behavior
  describe('Fallback When moc Not Available', () => {
    it('falls back to pattern matching when moc not found', async () => {
      // Mock moc as unavailable
      const result = await validateMotoko('actor { var x : Nat = 0; }', {
        mockMocUnavailable: true,
      });
      
      expect(result.issues.some(i => 
        i.message.includes('pattern-based validation')
      )).toBe(true);
    });

    it('still catches basic issues with pattern matching fallback', async () => {
      const code = 'func standalone() : Nat { 42 };'; // No actor
      const result = await validateMotoko(code, {
        mockMocUnavailable: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => 
        i.message.includes('No actor')
      )).toBe(true);
    });
  });

  // CATEGORY 7: Performance
  describe('Performance', () => {
    it('completes validation within reasonable time', async () => {
      const code = 'actor { stable var counter : Nat = 0; }';
      const start = Date.now();
      await validateMotoko(code);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should be under 1 second
    });

    it('caches identical validation requests', async () => {
      const code = 'actor {}';
      
      const start1 = Date.now();
      await validateMotoko(code);
      const duration1 = Date.now() - start1;
      
      const start2 = Date.now();
      await validateMotoko(code); // Should hit cache
      const duration2 = Date.now() - start2;
      
      expect(duration2).toBeLessThan(duration1 / 2); // Cache should be faster
    });
  });
});
```

---

## 🏗️ Error Parser Architecture

### Challenge: Multi-line Error Parsing

**Problem:**
```
file.mo:4.20-4.21: type error [M0096], expression of type
  Nat
cannot produce expected type
  Text
```

This is 4 lines but represents ONE error.

**Solution: State Machine Parser**

```typescript
interface ParserState {
  currentError: Partial<ValidationIssue> | null;
  errors: ValidationIssue[];
  mode: 'waiting' | 'in_error' | 'in_continuation';
}

function parseMocErrors(stderr: string): ValidationIssue[] {
  const lines = stderr.split('\n');
  const state: ParserState = {
    currentError: null,
    errors: [],
    mode: 'waiting',
  };

  for (const line of lines) {
    // Pattern 1: Start of new error
    if (isErrorStart(line)) {
      if (state.currentError) {
        state.errors.push(finalizeError(state.currentError));
      }
      state.currentError = parseErrorStart(line);
      state.mode = 'in_error';
    }
    // Pattern 2: Continuation line (indented)
    else if (state.mode === 'in_error' && line.startsWith('  ')) {
      state.currentError.message += '\n' + line.trim();
      state.mode = 'in_continuation';
    }
    // Pattern 3: Blank line (separator)
    else if (line.trim() === '') {
      if (state.currentError) {
        state.errors.push(finalizeError(state.currentError));
        state.currentError = null;
      }
      state.mode = 'waiting';
    }
  }

  // Don't forget last error
  if (state.currentError) {
    state.errors.push(finalizeError(state.currentError));
  }

  return state.errors;
}
```

---

## 🎛️ Implementation Decisions

### Decision 1: Import Handling

**Options:**
A. Always pass `--package base <path>` 
B. Only pass when code contains imports
C. Let user configure package paths

**Choice: A** - Always pass base package
**Reasoning:**
- Most Motoko code imports base
- Negligible performance impact
- Simplest UX (works automatically)

### Decision 2: moc Path Discovery

**Priority order:**
1. `dfx cache show` (most reliable)
2. `which moc` (if in PATH)
3. Fallback to pattern matching

**Caching:** Cache moc path for session (check once, reuse)

### Decision 3: Error Message Formatting

**Keep raw compiler messages** - don't try to "improve" them
**Reasoning:**
- Developers trust compiler output
- moc messages are already good
- Parsing is fragile enough without transforming

### Decision 4: Fallback Strategy

**Pattern matching remains as fallback**
**Benefits:**
- Works without dfx installed
- Provides at least basic validation
- Clear messaging about capabilities

---

## ⚠️ Known Limitations

### 1. Package Resolution
**Limitation:** Only resolves `base` package automatically  
**Workaround:** User-defined packages require project context (future)

### 2. Actor Classes
**Limitation:** Actor classes with parameters not tested  
**Risk:** Low (uncommon pattern)

### 3. System Functions
**Limitation:** Upgrade hooks validation limited  
**Impact:** Medium (but compiles correctly)

### 4. Performance
**Limitation:** Subprocess overhead ~50-200ms  
**Mitigation:** Caching reduces repeated validations

---

## 🔄 Migration Strategy

### Backwards Compatibility

**Users without dfx:**
```
Before: Pattern matching validation ⭐⭐
After:  Pattern matching validation ⭐⭐ (same)
        + Info message about dfx
```

**Users with dfx:**
```
Before: Pattern matching validation ⭐⭐
After:  Real compilation ⭐⭐⭐⭐⭐ (automatic upgrade)
```

### Version Bump

**v0.2.0 → v0.3.0**
- Minor version bump (new features)
- No breaking changes
- Enhanced validation but same API

### Documentation Updates

**README changes:**
```markdown
## Prerequisites

### Required
- Node.js 18+
- didc for Candid validation: `cargo install --git https://github.com/dfinity/candid.git didc`

### Optional (Recommended)
- dfx for full Motoko compilation: `sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"`
- Without dfx: Pattern-based Motoko validation (limited)
- With dfx: Full compiler validation (recommended)
```

---

## 📋 Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `findMocPath()` helper
- [ ] Create `findBasePath()` helper  
- [ ] Implement state machine parser `parseMocErrors()`
- [ ] Add moc path caching
- [ ] Refactor `validateMotoko()` to use moc
- [ ] Keep pattern matching as `fallbackValidation()`
- [ ] Add tests for all error types

### Phase 2: Edge Cases
- [ ] Handle multi-line errors correctly
- [ ] Handle multiple errors in one file
- [ ] Handle import errors gracefully
- [ ] Handle syntax errors with verbose output
- [ ] Handle empty files
- [ ] Handle unicode correctly

### Phase 3: Polish
- [ ] Add performance benchmarks
- [ ] Optimize subprocess execution
- [ ] Enhance caching strategy
- [ ] Add detailed logging
- [ ] Document error codes

### Phase 4: Testing
- [ ] Write unit tests (parser)
- [ ] Write integration tests (end-to-end)
- [ ] Test on multiple moc versions
- [ ] Test fallback behavior
- [ ] Test performance with large files

### Phase 5: Documentation
- [ ] Update README
- [ ] Add CHANGELOG entry
- [ ] Document moc requirement
- [ ] Add troubleshooting section
- [ ] Create migration guide

---

## 🎯 Success Criteria

### Functional
✅ Validates valid code without false positives  
✅ Catches type errors with line/column  
✅ Catches syntax errors  
✅ Handles imports correctly  
✅ Reports multiple errors  
✅ Falls back gracefully when moc unavailable  

### Performance
✅ Validation completes in <500ms  
✅ Cache reduces repeated validations by 80%+  
✅ No memory leaks from temp files  

### UX
✅ Clear error messages  
✅ Error codes provided  
✅ Helpful suggestions when moc not found  
✅ Works out-of-box for users with dfx  

---

**Ready for implementation? All edge cases mapped!**
