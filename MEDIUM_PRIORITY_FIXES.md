# Medium Priority Fixes - grok-cli

## Fixes Applied - 2026-01-28

### 1. ✅ Standardized Environment Variable Naming

**Issue:** Inconsistent usage of `OLLAMA_HOST` vs `GROKCLI_OLLAMA_ENDPOINT` across codebase.

**Solution:** Added fallback chain to support both variables with priority:
```typescript
process.env.GROKCLI_OLLAMA_ENDPOINT || process.env.OLLAMA_HOST || 'http://localhost:11434'
```

**Files Modified:**
- `/packages/cli/src/core/core/providerClient.ts`
- `/packages/cli/src/nonInteractiveCli.ts`
- `/packages/cli/src/ui/hooks/useProviderStream.ts`
- `/packages/cli/src/ui/hooks/slashCommandProcessor.ts`
- `/packages/cli/src/ui/hooks/useProviderCommand.ts`

**Usage:**
```bash
# Recommended (new standard)
export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11434"
export GROKCLI_OLLAMA_MODEL="llama3.2:latest"

# Still supported (backward compatibility)
export OLLAMA_HOST="http://localhost:11434"
```

**Impact:** Eliminates confusion, maintains backward compatibility, clarifies which env vars belong to grok-cli.

---

### 2. ✅ Added Retry Logic with Exponential Backoff

**Issue:** Provider API calls had no retry mechanism, leading to fragile connections and failures on transient errors.

**Solution:** Wrapped all HTTP requests in `retryWithBackoff()` utility with exponential backoff and jitter.

**XAI Provider (`xai.ts`):**
- `getModels()`: 2 attempts, 500ms-2s delay
- `queryWithTools()`: 3 attempts, 1s-10s delay
- Handles 429 (rate limit) and 5xx (server errors)
- Respects Retry-After headers

**Ollama Provider (`ollama.ts`):**
- `query()`: 3 attempts, 1s-10s delay
- `queryWithTools()`: 3 attempts, 1s-10s delay
- Handles connection timeouts and server errors

**Configuration:**
```typescript
await retryWithBackoff(
  async () => { /* API call */ },
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  }
);
```

**Impact:**
- Improved reliability on flaky connections
- Automatic recovery from transient errors
- Better handling of rate limits
- Reduced user-facing failures

---

### 3. ✅ Documented Streaming Limitation

**Issue:** `stream: true` option accepted but silently ignored, falling back to buffered responses.

**Solution:** Documented in `KNOWN_LIMITATIONS.md` as a known limitation requiring significant refactor.

**Why Not Fixed:**
- Requires redesigning provider interfaces
- Different streaming protocols (XAI uses SSE, Ollama has own format)
- Would affect multiple files
- Needs comprehensive testing

**Future Work:** See `KNOWN_LIMITATIONS.md` for implementation plan.

---

### 4. ✅ Documented Tool Continuation Bug

**Issue:** In non-interactive mode, tool results are executed but never sent back to the model.

**Solution:** Documented in `KNOWN_LIMITATIONS.md` with workaround and future implementation plan.

**Workaround:** Use interactive mode for tool-heavy workflows:
```bash
# Instead of:
grok -p "list files and read README"

# Use:
grok
> list files and read README
```

**Future Work:** Implement continuation loop in `nonInteractiveCli.ts`.

---

## Summary of Changes

| Fix | Status | Files Changed | Impact |
|-----|--------|---------------|---------|
| Env Variable Standardization | ✅ Complete | 5 files | High |
| Retry Logic | ✅ Complete | 2 files | High |
| Streaming Documentation | ✅ Complete | 1 file | Low |
| Tool Continuation Documentation | ✅ Complete | 1 file | Low |

---

## Retry Logic Details

### How It Works

1. **Automatic Retry on Transient Errors:**
   - HTTP 429 (Too Many Requests)
   - HTTP 5xx (Server Errors)
   - Network timeouts

2. **Exponential Backoff:**
   - Initial delay: 500ms-1s
   - Max delay: 2s-10s
   - Jitter: ±30% randomization

3. **Retry-After Header Support:**
   - Respects server-specified delays
   - Falls back to exponential backoff if not present

4. **Configurable Attempts:**
   - Models endpoint: 2 attempts (fast fail for config issues)
   - Query endpoints: 3 attempts (more resilience for important requests)

### Example Logs

```bash
# First attempt fails with 500
Attempt 1 failed with status 500. Retrying with backoff...
# Waits ~1 second with jitter

# Second attempt fails with 429
Attempt 2 failed with status 429. Retrying after explicit delay of 5000ms...
# Respects Retry-After: 5 header

# Third attempt succeeds
✅ XAI - Success! Response received
```

---

## Environment Variables Reference

### XAI Provider
```bash
XAI_API_KEY=your_xai_key          # Required
XAI_MODEL=grok-4-0709             # Optional, default: grok-4-0709
GROKCLI_CONTEXT_SIZE=128000       # Optional, default: 128000
```

### Ollama Provider
```bash
GROKCLI_OLLAMA_ENDPOINT=http://localhost:11434  # Preferred
OLLAMA_HOST=http://localhost:11434              # Fallback (deprecated)
GROKCLI_OLLAMA_MODEL=llama3.2:latest           # Optional, default: llama3.2:latest
```

### General
```bash
GROKCLI_PROVIDER=xai              # Optional, default: xai
DEBUG=1                           # Optional, enables debug logging
```

---

## Testing Recommendations

After these fixes, test:

1. **Retry Logic:**
   ```bash
   # Simulate rate limiting or server errors
   # Verify automatic retry with backoff
   # Check logs for retry attempts
   ```

2. **Environment Variables:**
   ```bash
   # Test GROKCLI_OLLAMA_ENDPOINT priority
   export GROKCLI_OLLAMA_ENDPOINT="http://custom:11434"
   export OLLAMA_HOST="http://old:11434"
   # Should use http://custom:11434

   # Test backward compatibility
   unset GROKCLI_OLLAMA_ENDPOINT
   # Should fall back to OLLAMA_HOST
   ```

3. **Error Recovery:**
   ```bash
   # Stop Ollama temporarily
   # Try query - should retry and timeout gracefully
   # Start Ollama during retry window
   # Query should succeed on retry
   ```

---

## Next Steps

See `KNOWN_LIMITATIONS.md` for remaining medium priority work:
- Implement streaming support
- Fix tool continuation in non-interactive mode
- Add unit tests for providers

---

Last Updated: 2026-01-28
