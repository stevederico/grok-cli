# Known Limitations - grok-cli

This document tracks known limitations and planned improvements for grok-cli.

## 1. Streaming Not Implemented

**Status:** Known Limitation
**Priority:** Medium
**Location:** `/packages/cli/src/core/core/providerClient.ts:53-60`

### Description
The `sendMessage` method accepts a `stream: true` option but silently falls back to non-streaming mode:

```typescript
if (options.stream) {
  // For streaming, we'll need to implement provider-specific streaming
  // For now, fall back to non-streaming and yield the result
  const response = await runQuery(prompt, provider, providerConfig, {
    ...queryOptions,
    stream: false
  });
  yield response;
}
```

### Impact
- Users expect streaming responses but get buffered responses instead
- No real-time feedback during long responses
- Higher perceived latency

### Why Not Fixed
- Requires significant refactor of provider interfaces
- XAI and Ollama APIs have different streaming protocols
- Need to implement Server-Sent Events (SSE) parsing
- Would affect multiple files and the provider abstraction layer

### Workaround
None currently. All responses are buffered.

### Future Work
1. Define streaming interface in `Provider` base class
2. Implement SSE parsing for XAI provider
3. Implement streaming for Ollama provider
4. Update ProviderClient to properly handle streaming
5. Add streaming tests

---

## 2. Tool Continuation Incomplete in Non-Interactive Mode

**Status:** Known Bug
**Priority:** Medium
**Location:** `/packages/cli/src/nonInteractiveCli.ts:66-97`

### Description
In non-interactive mode, when the model requests tool execution, the tools are executed but the results are never sent back to the model for continuation:

```typescript
for (const toolCall of response.tool_calls) {
  // Execute tool and accumulate results
  const toolResult = await toolRegistry.executeTool(toolCall);
  toolResults.push(toolResult);
}
// Results are accumulated but never sent back to the model!
```

### Impact
- Tool calling doesn't work properly in non-interactive mode
- Model requests tools but never sees results
- Incomplete responses to users

### Why Not Fixed
- Requires implementing the continuation loop
- Need to restructure the non-interactive flow
- Testing complexity (need to mock tool execution)

### Workaround
Use interactive mode (`grok` without `-p` flag) for tool-heavy workflows.

### Future Work
```typescript
// Pseudo-code for fix:
let response = await provider.queryWithTools(prompt, tools, options);

while (response.tool_calls && response.tool_calls.length > 0) {
  const toolResults = [];
  for (const toolCall of response.tool_calls) {
    const result = await toolRegistry.executeTool(toolCall);
    toolResults.push(result);
  }

  // Send tool results back for continuation
  response = await provider.queryWithTools('', tools, {
    tool_results: toolResults,
    previous_assistant_response: response
  });
}

console.log(response.content);
```

---

## 3. Environment Variable Naming Inconsistency (PARTIALLY FIXED)

**Status:** Improved
**Priority:** Low (after fix)
**Location:** Multiple files

### Original Issue
Mixed usage of `OLLAMA_HOST` and `GROKCLI_OLLAMA_ENDPOINT`.

### Current Solution
Now supports both with priority fallback:
```typescript
process.env.GROKCLI_OLLAMA_ENDPOINT || process.env.OLLAMA_HOST || 'http://localhost:11434'
```

### Recommended Usage
Prefer `GROKCLI_OLLAMA_ENDPOINT` for clarity:
```bash
export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11434"
export GROKCLI_OLLAMA_MODEL="llama3.2:latest"
```

Backward compatible with `OLLAMA_HOST` if `GROKCLI_OLLAMA_ENDPOINT` not set.

---

## 4. No Unit Tests for Providers

**Status:** Missing Tests
**Priority:** Medium
**Location:** `/packages/cli/src/core/providers/`

### Description
Zero test coverage for provider implementations:
- No tests for `xai.ts`
- No tests for `ollama.ts`
- No tests for tool calling
- No tests for retry logic
- No tests for error handling

### Impact
- Difficult to refactor with confidence
- Regression risk when making changes
- Provider bugs may go unnoticed

### Future Work
Create test files:
- `xai.test.ts` - Test XAI provider
- `ollama.test.ts` - Test Ollama provider
- `providerClient.test.ts` - Test provider client

Minimum test coverage:
- API response parsing
- Tool call handling
- Token truncation logic
- Error handling paths
- Retry logic
- Fallback behavior (Ollama)

---

## Summary

| Issue | Status | Priority | Complexity |
|-------|--------|----------|------------|
| Streaming | Not Implemented | Medium | High |
| Tool Continuation (non-interactive) | Bug | Medium | Medium |
| Env Variable Names | Improved | Low | ✅ Fixed |
| Unit Tests | Missing | Medium | Medium |

---

## Contributing

If you want to tackle any of these limitations:

1. **Streaming Implementation:**
   - Start with XAI provider (simpler protocol)
   - Add `streamWithTools()` method to Provider interface
   - Implement SSE parsing
   - Add streaming tests

2. **Tool Continuation:**
   - Focus on `nonInteractiveCli.ts`
   - Implement continuation loop
   - Add tests for multi-turn tool usage
   - Handle errors in tool execution

3. **Unit Tests:**
   - Use `vitest` (already configured)
   - Mock fetch calls
   - Test happy path and error cases
   - Aim for 80%+ coverage on providers

---

Last Updated: 2026-01-28
