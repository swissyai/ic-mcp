/**
 * Security pattern detection for Motoko and Rust
 * Identifies common security vulnerabilities in ICP canisters
 */

import type { ValidationIssue } from '../types/index.js';

/**
 * Check for HTTPS outcalls patterns (both Motoko and Rust)
 */
export function checkHttpsOutcalls(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if code uses HTTPS outcalls
  const usesHttpOutcalls =
    code.includes('http_request') ||
    code.includes('HttpRequest') ||
    code.includes('management_canister') ||
    code.includes('CanisterHttpRequest');

  if (!usesHttpOutcalls) {
    return issues;
  }

  // Check 1: Missing transform function
  const hasTransform =
    code.includes('transform') ||
    code.includes('Transform') ||
    code.includes('transform_func');

  if (!hasTransform) {
    issues.push({
      severity: 'warning',
      message: 'HTTPS outcall without transform function',
      explanation:
        'ICP HTTPS outcalls require consensus across replica nodes. Without a transform function, non-deterministic response data (timestamps, headers, cookies) will cause consensus failures and waste cycles. The transform function sanitizes responses to ensure all replicas agree on the result.',
      suggestedFix: `// Motoko\nlet transform = {\n  function = transform_response;\n  context = Blob.fromArray([]);\n};\n\n// Rust\nlet transform = TransformContext {\n  function: TransformFunc(candid::Func {\n    principal: ic_cdk::id(),\n    method: "transform".to_string(),\n  }),\n  context: vec![],\n};`,
      references: [
        'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
        'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
      ],
      example: `// Transform function that strips non-deterministic data\nfunc transform_response(raw : HttpResponse) : HttpResponse {\n  {\n    status = raw.status;\n    body = raw.body;\n    headers = []; // Strip all headers for determinism\n  }\n};`,
    });
  }

  // Check 2: URL length
  const urlPattern = /url\s*[:=]\s*["']([^"']+)["']/gi;
  const urls = Array.from(code.matchAll(urlPattern));

  for (const match of urls) {
    const url = match[1];
    if (url.length > 8192) {
      issues.push({
        severity: 'error',
        message: `HTTPS outcall URL exceeds 8192 character limit (${url.length} chars)`,
        explanation:
          'Per RFC-3986, ICP restricts HTTPS outcall URLs to 8192 characters maximum. URLs exceeding this limit will cause the outcall to trap, wasting cycles and potentially leaving your canister in an inconsistent state.',
        suggestedFix:
          'Shorten the URL or use POST with parameters in the request body instead of query parameters',
        references: [
          'https://www.rfc-editor.org/rfc/rfc3986',
          'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
        ],
      });
    }
  }

  // Check 3: Response size limit
  const hasMaxResponseBytes =
    code.includes('max_response_bytes') || code.includes('maxResponseBytes');

  if (!hasMaxResponseBytes) {
    issues.push({
      severity: 'info',
      message: 'HTTPS outcall without explicit max_response_bytes',
      explanation:
        'Without specifying max_response_bytes, ICP defaults to 2MB maximum. Setting an appropriate limit prevents excessive cycle costs and protects against unexpectedly large responses that could trap your canister due to memory limits.',
      suggestedFix:
        'max_response_bytes = ?1_000_000; // 1MB limit\n// or\nmax_response_bytes: Some(1_000_000), // Rust',
      references: [
        'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
      ],
      example: `let request = {\n  url = "https://api.example.com/data";\n  max_response_bytes = ?1_000_000; // 1MB\n  method = #get;\n  headers = [];\n  body = null;\n  transform = ?transform;\n};`,
    });
  }

  // Check 4: HTTP method restrictions
  const methodPattern = /method\s*[:=]\s*#?(get|post|head|put|delete|patch)/gi;
  const methods = Array.from(code.matchAll(methodPattern));

  for (const match of methods) {
    const method = match[1].toLowerCase();
    if (!['get', 'post', 'head'].includes(method)) {
      issues.push({
        severity: 'error',
        message: `HTTPS outcall uses unsupported HTTP method: ${method}`,
        explanation:
          'ICP HTTPS outcalls only support GET, HEAD, and POST methods. This limitation ensures deterministic behavior across replicas and prevents side effects from methods like PUT/DELETE that might succeed on some replicas but fail on others.',
        suggestedFix: `// Use supported methods only:\nmethod = #get;  // or #post or #head`,
        references: [
          'https://docs.internetcomputer.org/guides/backends/https-outcalls/',
        ],
      });
    }
  }

  return issues;
}

/**
 * Security check for Motoko code
 */
export function checkMotokoSecurity(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check 1: Missing caller verification in update methods
  if (hasUpdateMethods(code) && !hasCallerChecks(code)) {
    issues.push({
      severity: 'warning',
      message: 'Update methods without caller verification detected',
      explanation: 'On the Internet Computer, any user can call public update methods unless you explicitly check the caller. Without authentication, malicious actors can modify your canister state, drain cycles, or perform admin operations. The msg.caller field provides the authenticated principal of the caller.',
      suggestedFix: 'public shared ({ caller }) func adminAction() : async () {\n  if (caller != owner) { Runtime.trap("caller is not the owner") };\n  // ...\n};',
      references: [
        'https://docs.internetcomputer.org/guides/security/identity-and-access-management/',
        'https://skills.internetcomputer.org/skills/canister-security/',
      ],
      example: 'public shared ({ caller }) func setOwner(newOwner : Principal) : async () {\n  if (caller != owner) { Runtime.trap("caller is not the owner") };\n  owner := newOwner;\n};',
      // Deprecated fields for backward compat
      suggestion: 'Check the caller: public shared ({ caller }) func ... { if (caller != owner) { Runtime.trap("...") } }',
      docUrl: 'https://docs.internetcomputer.org/guides/security/identity-and-access-management/',
    });
  }

  // Check 2: Unbounded data structures
  const unboundedStructures = findUnboundedStructures(code);
  for (const structure of unboundedStructures) {
    issues.push({
      severity: 'warning',
      message: `Unbounded ${structure.type} '${structure.name}' may cause heap overflow`,
      line: structure.line,
      explanation: `ICP canisters have a 4GB heap limit. Unbounded data structures like ${structure.type} can grow indefinitely as users interact with your canister, eventually causing out-of-memory traps that brick the canister. Without size limits or pagination, an attacker could deliberately fill the structure to cause denial of service.`,
      suggestedFix: `if (${structure.name}.size() >= MAX_ENTRIES) {\n  return #err("Storage limit reached");\n};`,
      references: [
        'https://docs.internetcomputer.org/guides/security/dos-prevention/',
        'https://skills.internetcomputer.org/skills/stable-memory/',
      ],
      example: `public shared ({ caller }) func store(key : Text, value : Text) : async Result.Result<(), Text> {\n  if (storage.size() >= MAX_ENTRIES) {\n    return #err("Storage limit reached");\n  };\n  storage.add(key, value);\n  #ok(())\n};`,
      // Deprecated fields
      suggestion: `Use stable storage with size limits or pagination`,
      docUrl: 'https://skills.internetcomputer.org/skills/stable-memory/',
    });
  }

  // Check 3: Arithmetic operations without overflow checks
  if (hasArithmeticOperations(code) && !hasOverflowChecks(code)) {
    issues.push({
      severity: 'info',
      message: 'Arithmetic that can trap: Nat subtraction traps when the result would be negative, and division traps on zero',
      explanation: 'Nat and Int have unbounded precision, so they do not overflow, but `a - b` on Nat traps when b > a and division by zero traps. A trap rolls back the message.',
      suggestedFix: 'Avoid Nat subtraction unless the result is provably non-negative at the operation; check bounds first and return #err.',
      references: ['https://skills.internetcomputer.org/skills/writing-motoko/'],
      // Deprecated fields
      suggestion: 'Check bounds before Nat subtraction and division',
    });
  }

  // Check 4: Unsafe trap conditions
  const trapPatterns = findUnsafeTraps(code);
  for (const trap of trapPatterns) {
    issues.push({
      severity: 'warning',
      message: `Unsafe trap at line ${trap.line}: ${trap.reason}`,
      line: trap.line,
      explanation: 'Traps halt canister execution and roll back all state changes in that message. Frequent traps waste cycles and degrade user experience. More critically, traps in upgrade hooks (preupgrade/postupgrade) can brick your canister permanently. Always use Result types or explicit error handling instead of assertions in production code.',
      suggestedFix: `// Instead of:\n// assert(condition);\n\n// Use:\nif (not condition) {\n  return #err("descriptive error message");\n};`,
      references: [
        'https://skills.internetcomputer.org/skills/writing-motoko/',
        'https://docs.internetcomputer.org/guides/security/dos-prevention/',
      ],
      example: `actor {\n  public func safeWithdraw(amount : Nat) : async Result.Result<Nat, Text> {\n    if (amount > balance) {\n      return #err("Insufficient balance");\n    };\n    balance -= amount;\n    #ok(balance)\n  };\n};`,
      // Deprecated fields
      suggestion: 'Return Result type or handle error gracefully',
    });
  }

  return issues;
}

/**
 * Security check for Rust code
 */
export function checkRustSecurity(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check 1: Unwrap/expect in canister methods
  const unsafeUnwraps = findUnsafeUnwraps(code);
  for (const unwrap of unsafeUnwraps) {
    issues.push({
      severity: 'warning',
      message: `Unsafe ${unwrap.method} at line ${unwrap.line} may cause trap`,
      line: unwrap.line,
      explanation: `Using .unwrap() or .expect() in canister code causes a panic (trap) when the value is None/Err. On ICP, traps roll back all state changes and waste cycles. In production canisters, this creates a poor user experience and potential denial-of-service if attackers can trigger the panic condition. Always use proper error handling with Result types.`,
      suggestedFix: `// Instead of:\n// let value = option.unwrap();\n\n// Use:\nlet value = option?; // Early return with ?\n// or\nmatch option {\n    Some(v) => v,\n    None => return Err("not found".to_string()),\n}`,
      references: [
        'https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html',
        'https://docs.internetcomputer.org/guides/canister-management/troubleshooting/',
      ],
      example: `#[update]\nfn safe_get(key: String) -> Result<String, String> {\n    let storage = STORAGE.with(|s| s.borrow().clone());\n    storage.get(&key)\n        .ok_or_else(|| "Key not found".to_string())\n}`,
      // Deprecated fields
      suggestion: 'Use ? operator or match for proper error handling',
    });
  }

  // Check 2: Missing caller verification
  if (hasUpdateMethods(code) && !/\b(msg_)?caller\(\)/.test(code)) {
    issues.push({
      severity: 'warning',
      message: 'Update methods without caller verification',
      explanation: 'On the Internet Computer, any user can call public update methods unless you explicitly verify the caller. The ic_cdk::api::msg_caller() function returns the authenticated Principal of the caller. Without these checks, malicious actors can execute privileged operations, modify state, or drain the canister of cycles.',
      suggestedFix: `use ic_cdk::api::msg_caller;\nuse candid::Principal;\n\nthread_local! {\n    static OWNER: RefCell<Principal> = RefCell::new(Principal::anonymous());\n}\n\n#[update]\nfn admin_action() -> Result<(), String> {\n    let caller = msg_caller();\n    OWNER.with(|owner| {\n        if caller != *owner.borrow() {\n            return Err("Unauthorized".to_string());\n        }\n        Ok(())\n    })\n}`,
      references: [
        'https://docs.internetcomputer.org/guides/security/identity-and-access-management/',
        'https://docs.internetcomputer.org/guides/security/identity-and-access-management/',
      ],
      example: `use ic_cdk::{api::msg_caller, update};\nuse candid::Principal;\n\n#[update]\nfn set_owner(new_owner: Principal) -> Result<(), String> {\n    let caller = msg_caller();\n    if caller != get_owner() {\n        return Err("Only owner can change owner".to_string());\n    }\n    set_owner_internal(new_owner);\n    Ok(())\n}`,
      // Deprecated fields
      suggestion: 'Add: let caller = ic_cdk::api::msg_caller(); and compare it with the owner',
    });
  }

  // Check 3: Reentrancy risks in inter-canister calls
  const reentrancyRisks = findReentrancyRisks(code);
  for (const risk of reentrancyRisks) {
    issues.push({
      severity: 'warning',
      message: `Potential reentrancy at line ${risk.line}`,
      line: risk.line,
      explanation: 'Reentrancy occurs when a canister modifies state after making an inter-canister call (.await). While the call is pending, another message could invoke the same function, seeing stale state and potentially causing double-spending or other inconsistencies. ICP uses the actor model which processes messages sequentially, but you must still follow checks-effects-interactions pattern.',
      suggestedFix: `// BAD: State change after await\nlet result = other_canister.call().await?;\nstorage.insert(key, value); // ❌ State modified after await\n\n// GOOD: State change before await\nstorage.insert(key, value); // ✅ State modified first\nlet result = other_canister.call().await?;`,
      references: [
        'https://docs.internetcomputer.org/guides/security/inter-canister-calls/',
        'https://www.certik.com/resources/blog/5tMef3TRX7h4UnymEYXK36-common-smart-contract-vulnerabilities-and-how-to-mitigate-them',
      ],
      example: `#[update]\nasync fn safe_transfer(to: Principal, amount: u64) -> Result<(), String> {\n    // 1. Checks\n    if amount > get_balance() {\n        return Err("Insufficient balance".to_string());\n    }\n    \n    // 2. Effects (update state BEFORE await)\n    deduct_balance(amount);\n    \n    // 3. Interactions (external calls last)\n    match notify_recipient(to, amount).await {\n        Ok(_) => Ok(()),\n        Err(e) => {\n            // Revert state on failure\n            add_balance(amount);\n            Err(e)\n        }\n    }\n}`,
      // Deprecated fields
      suggestion: 'Use checks-effects-interactions pattern: verify state before await',
    });
  }

  // Check 4: Unbounded memory allocations
  if (code.includes('Vec::new()') && !code.includes('with_capacity')) {
    issues.push({
      severity: 'info',
      message: 'Consider using Vec::with_capacity for known sizes',
      explanation: 'ICP canisters have a 4GB heap limit. When Vec grows beyond its capacity, Rust reallocates the entire vector, which is expensive in terms of both cycles and memory fragmentation. If you know the approximate size ahead of time, using Vec::with_capacity reduces allocations and can prevent out-of-memory traps for large datasets.',
      suggestedFix: `// Instead of:\nlet mut items = Vec::new();\n\n// Use:\nlet mut items = Vec::with_capacity(1000); // Preallocate`,
      references: [
        'https://doc.rust-lang.org/std/vec/struct.Vec.html#method.with_capacity',
        'https://skills.internetcomputer.org/skills/stable-memory/',
      ],
      example: `use std::collections::HashMap;\n\n#[update]\nfn batch_insert(items: Vec<(String, String)>) -> Result<(), String> {\n    let mut storage = HashMap::with_capacity(items.len());\n    \n    for (key, value) in items {\n        if storage.len() >= MAX_ITEMS {\n            return Err("Storage limit reached".to_string());\n        }\n        storage.insert(key, value);\n    }\n    Ok(())\n}`,
      // Deprecated fields
      suggestion: 'Reduces memory allocations and improves performance',
    });
  }

  return issues;
}

// === Helper functions ===

function hasUpdateMethods(code: string): boolean {
  return (
    code.includes('public func') ||
    code.includes('#[update]') ||
    code.includes('public shared')
  );
}

function hasCallerChecks(code: string): boolean {
  return (
    code.includes('msg.caller') ||
    code.includes('msg_caller()') ||
    code.includes('caller()')
  );
}

function findUnboundedStructures(code: string): Array<{ type: string; name: string; line?: number }> {
  const structures: Array<{ type: string; name: string; line?: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // HashMap/TrieMap without size limit
    if (line.match(/(var|let)\s+(\w+)\s*=\s*(HashMap|TrieMap)\.new/)) {
      const nameMatch = line.match(/(var|let)\s+(\w+)/);
      if (nameMatch) {
        structures.push({
          type: line.includes('HashMap') ? 'HashMap' : 'TrieMap',
          name: nameMatch[2],
          line: i + 1,
        });
      }
    }

    // Buffer/Array without limit
    if (line.match(/(var|let)\s+(\w+)\s*=\s*Buffer\.Buffer/)) {
      const nameMatch = line.match(/(var|let)\s+(\w+)/);
      if (nameMatch) {
        structures.push({ type: 'Buffer', name: nameMatch[2], line: i + 1 });
      }
    }
  }

  return structures;
}

function hasArithmeticOperations(code: string): boolean {
  return /[\+\-\*\/]/.test(code) && (code.includes(': Nat') || code.includes(': Int'));
}

function hasOverflowChecks(code: string): boolean {
  return code.includes('Nat.add') || code.includes('Int.add') || code.includes('checked_');
}

function findUnsafeTraps(code: string): Array<{ line: number; reason: string }> {
  const traps: Array<{ line: number; reason: string }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Direct assert without message
    if (line.match(/assert\s*\(/)) {
      traps.push({ line: i + 1, reason: 'Assert without error message' });
    }

    // Array indexing without bounds check
    if (line.match(/\[\s*\d+\s*\]/) && !line.includes('get(')) {
      traps.push({ line: i + 1, reason: 'Direct array indexing (use .get())' });
    }
  }

  return traps;
}


function findUnsafeUnwraps(code: string): Array<{ method: string; line: number }> {
  const unwraps: Array<{ method: string; line: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('.unwrap()')) {
      unwraps.push({ method: 'unwrap', line: i + 1 });
    }

    if (line.includes('.expect(')) {
      unwraps.push({ method: 'expect', line: i + 1 });
    }
  }

  return unwraps;
}

function findReentrancyRisks(code: string): Array<{ line: number }> {
  const risks: Array<{ line: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // State modification after await
    if (i > 0 && lines[i - 1].includes('.await') && line.match(/(\.insert|\.remove|=)/)) {
      risks.push({ line: i + 1 });
    }
  }

  return risks;
}
