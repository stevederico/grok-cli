# Bug Fixes Applied - grok-cli

## Critical Issues Fixed

### 1. ✅ Removed Duplicate Provider File
**Issue:** Both `grok.ts` and `xai.ts` contained identical `XAIProvider` classes, causing unpredictable behavior.

**Fix:**
- Deleted `/packages/cli/src/core/providers/grok.ts` (duplicate)
- Kept `xai.ts` which has token truncation logic
- Updated `/packages/cli/src/core/index.ts` to export from `xai.js` instead of `grok.js`

**Impact:** Eliminates confusion and ensures consistent XAI provider behavior.

---

### 2. ✅ Fixed Type Error in errors.ts
**Issue:** Line 61 had `return typeof error.response?.data as ResponseData` which returns the string "object" instead of the actual data.

**Fix:**
```typescript
// BEFORE (WRONG)
return typeof error.response?.data as ResponseData;

// AFTER (CORRECT)
return error.response?.data as ResponseData;
```

**Impact:** Prevents runtime type errors in error handling.

---

### 3. ✅ Added Request Timeout to XAI Provider
**Issue:** XAI provider had no timeout on fetch requests, could hang indefinitely.

**Fix:**
- Added `signal: AbortSignal.timeout(60000)` to chat completions endpoint (60s)
- Added `signal: AbortSignal.timeout(10000)` to models endpoint (10s)
- Matches Ollama provider's timeout pattern

**Impact:** Prevents CLI from hanging on slow/failed API requests.

---

### 4. ✅ Added JSON.parse Error Handling in Ollama Provider
**Issue:** Line 122-124 had unprotected `JSON.parse()` that could throw on malformed JSON.

**Fix:**
```typescript
// Added try-catch around JSON.parse
try {
  parsedArguments = JSON.parse(tc.function.arguments);
} catch (error) {
  console.error(`Failed to parse tool arguments: ${tc.function.arguments}`, error);
  parsedArguments = {}; // Fallback to empty object
}
```

**Impact:** Prevents crashes during tool continuation with malformed arguments.

---

### 5. ✅ Gated Debug Logging Behind DEBUG Environment Variable
**Issue:** 41+ console.log statements with emojis polluted production output and exposed API key presence.

**Fix:**
- Added `isDebugEnabled()` helper function checking `process.env.DEBUG`
- Wrapped all debug console.log statements in XAI provider with `if (isDebugEnabled())`
- Debug output only shows when `DEBUG=1` or `DEBUG=true`

**Impact:**
- Clean output in production
- Debug info available when needed via `DEBUG=1 grok`
- Reduced information leakage

---

## How to Use Debug Mode

To enable debug logging:
```bash
# Enable debug mode
DEBUG=1 grok

# Or
export DEBUG=true
grok
```

Without DEBUG set, the CLI will have clean output with no emoji-prefixed debug messages.

---

## Files Modified

1. `/packages/cli/src/core/providers/grok.ts` - **DELETED**
2. `/packages/cli/src/core/index.ts` - Updated export
3. `/packages/cli/src/core/utils/errors.ts` - Fixed typeof error
4. `/packages/cli/src/core/providers/xai.ts` - Added timeouts + gated debug logs
5. `/packages/cli/src/core/providers/ollama.ts` - Added JSON.parse error handling

---

## Remaining Issues (Medium/Low Priority)

These issues were identified but not fixed in this session:

**Medium Priority:**
- Streaming not implemented (falls back to non-streaming despite option)
- Tool continuation loop incomplete in non-interactive mode
- Inconsistent environment variable naming (OLLAMA_HOST vs GROKCLI_OLLAMA_ENDPOINT)
- Missing retry logic for API requests
- No unit tests for providers

**Low Priority:**
- Dead code / commented legacy code cleanup
- System prompt duplication
- Inconsistent error message formatting
- Config class violates Single Responsibility Principle (493 lines)

---

## Testing Recommendations

After these fixes, test:

1. **XAI Provider:**
   ```bash
   export XAI_API_KEY="your_key"
   grok
   # Test normal queries
   # Test tool usage
   # Verify no debug output without DEBUG=1
   ```

2. **Ollama Provider:**
   ```bash
   export GROKCLI_PROVIDER=ollama
   grok
   # Test tool continuation
   # Verify malformed JSON handling
   ```

3. **Debug Mode:**
   ```bash
   DEBUG=1 grok
   # Verify debug output appears
   ```

---

## Version
These fixes applied on: 2026-01-28
