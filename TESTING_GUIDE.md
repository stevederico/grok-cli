# Testing Guide - grok-cli Fixes

Comprehensive guide to test all bug fixes and improvements.

---

## Prerequisites

```bash
cd /Users/sd/Desktop/test/grok-cli

# Install dependencies
npm install

# Build the project
npm run build

# Verify build succeeded
ls -la dist/
```

---

## Test 1: Critical Fixes - Provider Selection

### Test Duplicate Provider Fix

```bash
# Verify grok.ts is deleted
ls packages/cli/src/core/providers/grok.ts
# Should show: No such file or directory

# Verify xai.ts exists
ls packages/cli/src/core/providers/xai.ts
# Should show: packages/cli/src/core/providers/xai.ts

# Build and check for errors
npm run build
# Should succeed without errors about duplicate exports
```

### Test Provider Name Support

```bash
# Test with 'xai' provider name
export GROKCLI_PROVIDER=xai
export XAI_API_KEY="test-key"
node dist/index.js --version

# Test with 'grok' provider name (backward compat)
export GROKCLI_PROVIDER=grok
node dist/index.js --version

# Both should work without errors
```

---

## Test 2: Debug Logging

### Without DEBUG (Clean Output)

```bash
unset DEBUG
export XAI_API_KEY="your_real_key"
export GROKCLI_PROVIDER=xai

# Run a simple query
echo "What is 2+2?" | node dist/index.js -p "answer this"

# Output should be CLEAN - no emoji logs like:
# 🚀 XAI - Making request...
# 📦 XAI - Using model...
# ✅ XAI - Success!
```

### With DEBUG=1 (Verbose Output)

```bash
export DEBUG=1
export XAI_API_KEY="your_real_key"

echo "What is 2+2?" | node dist/index.js -p "answer this"

# Should now see verbose logs:
# 🚀 XAI - Making request to: https://api.x.ai/v1/chat/completions
# 📦 XAI - Using model: grok-4-0709
# 🔑 XAI - API key configured: YES
# ✅ XAI - Success! Response received
```

---

## Test 3: Request Timeouts

### Test XAI Timeout

```bash
# This test requires a slow/broken endpoint
# Option 1: Set invalid endpoint
export XAI_API_KEY="test"
export GROKCLI_PROVIDER=xai

# Modify endpoint in code temporarily or:
# The request should timeout after 60 seconds instead of hanging forever

# Option 2: Test with network issues
# Disconnect internet, run query, should timeout not hang
```

### Test Ollama Timeout

```bash
# Make sure Ollama is NOT running
killall ollama 2>/dev/null

export GROKCLI_PROVIDER=ollama

echo "test" | node dist/index.js -p "test"

# Should timeout after 30 seconds with error:
# "Ollama connection timeout. Check if Ollama service is running at http://localhost:11434"
```

---

## Test 4: Error Message Formatting

### Test XAI Error Messages

```bash
# Test without API key
unset XAI_API_KEY
export GROKCLI_PROVIDER=xai

node dist/index.js -p "test"

# Should see:
# Error: XAI: Provider not configured. Set XAI_API_KEY environment variable
# Note the format: [Provider]: [Description]. [Action]
```

### Test Ollama Error Messages

```bash
# Test with Ollama not running
export GROKCLI_PROVIDER=ollama

node dist/index.js -p "test"

# Should see:
# Error: Ollama connection timeout. Check if Ollama service is running at http://localhost:11434

# Test with invalid model
export GROKCLI_OLLAMA_MODEL="nonexistent-model"
# Start Ollama
ollama serve &
sleep 2

node dist/index.js -p "test"

# Should see:
# Error: Ollama: Model 'nonexistent-model' not found. Available models: [...]
```

---

## Test 5: Retry Logic

### Test Retry on Transient Errors

This is hard to test without mocking, but you can:

```bash
# Enable debug to see retry attempts
export DEBUG=1
export XAI_API_KEY="your_real_key"

# If XAI returns 429 or 5xx, you should see:
# Attempt 1 failed with status 429. Retrying with backoff...
# Attempt 2 failed with status 429. Retrying after explicit delay of 5000ms...
# etc.

# To simulate: temporarily modify xai.ts to always return 500 status
# Then run a query and verify retry attempts
```

### Test Retry Success

```bash
# With flaky internet connection
# Should see retries and eventual success
export DEBUG=1
export XAI_API_KEY="your_real_key"

node dist/index.js -p "what is 2+2"

# Watch for retry log messages if connection is flaky
```

---

## Test 6: Environment Variable Standardization

### Test GROKCLI_OLLAMA_ENDPOINT Priority

```bash
# Start Ollama on custom port
ollama serve --port 11435 &
sleep 2

# Test priority: GROKCLI_OLLAMA_ENDPOINT takes precedence
export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11435"
export OLLAMA_HOST="http://localhost:11434"  # Should be ignored
export GROKCLI_PROVIDER=ollama
export GROKCLI_OLLAMA_MODEL="llama3.2:latest"

# Pull model if needed
ollama pull llama3.2:latest

node dist/index.js -p "Say hello in 3 words"

# Should connect to port 11435 (not 11434)
```

### Test Backward Compatibility

```bash
# Test with only old env var
unset GROKCLI_OLLAMA_ENDPOINT
export OLLAMA_HOST="http://localhost:11434"
export GROKCLI_PROVIDER=ollama

# Restart Ollama on default port
killall ollama
ollama serve &
sleep 2

node dist/index.js -p "Say hello in 3 words"

# Should work - falls back to OLLAMA_HOST
```

---

## Test 7: JSON.parse Error Handling

This is internal - hard to test directly, but:

```bash
# If you can trigger tool continuation with malformed JSON:
# The CLI should not crash
# Instead it should log error and use empty object fallback

export DEBUG=1
export GROKCLI_PROVIDER=ollama

# Run interactive mode and use tools
node dist/index.js
# > list files in current directory
# Even if tool args are malformed, should not crash
```

---

## Test 8: Centralized System Prompt

### Verify System Prompt Works

```bash
export XAI_API_KEY="your_real_key"
export GROKCLI_PROVIDER=xai

# Test that it understands current directory
node dist/index.js -p "list files in this directory using glob tool"

# Should use glob tool with current directory
# Not ask for absolute paths
```

---

## Test 9: Interactive Mode

### Full Interactive Test

```bash
export XAI_API_KEY="your_real_key"
export GROKCLI_PROVIDER=xai

# Start interactive mode
node dist/index.js

# Try various commands:
# > what is 2+2
# > list files in current directory
# > read the README file
# > exit
```

---

## Test 10: Build & Type Check

### Run All Build Steps

```bash
# Clean build
npm run clean
npm run build

# Should succeed without errors

# Type check (if TypeScript)
npm run typecheck

# Should succeed without errors

# Lint
npm run lint

# May have warnings but should not fail on our changes
```

---

## Test 11: Automated Tests

### Run Test Suite

```bash
# Run all tests
npm test

# Run with coverage
npm run test:ci

# Check if our changes broke any tests
# All tests should pass
```

---

## Quick Smoke Test Script

Create a test script:

```bash
cat > test-fixes.sh << 'EOF'
#!/bin/bash
set -e

echo "🧪 Testing grok-cli fixes..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Build
echo -e "\n📦 Test 1: Building..."
npm run build > /dev/null 2>&1 && echo -e "${GREEN}✓ Build succeeded${NC}" || echo -e "${RED}✗ Build failed${NC}"

# Test 2: Duplicate file removed
echo -e "\n🗑️  Test 2: Checking duplicate file removed..."
! test -f packages/cli/src/core/providers/grok.ts && echo -e "${GREEN}✓ grok.ts removed${NC}" || echo -e "${RED}✗ grok.ts still exists${NC}"

# Test 3: XAI file exists
echo -e "\n✅ Test 3: Checking xai.ts exists..."
test -f packages/cli/src/core/providers/xai.ts && echo -e "${GREEN}✓ xai.ts exists${NC}" || echo -e "${RED}✗ xai.ts missing${NC}"

# Test 4: System prompt file exists
echo -e "\n📝 Test 4: Checking systemPrompts.ts exists..."
test -f packages/cli/src/core/providers/systemPrompts.ts && echo -e "${GREEN}✓ systemPrompts.ts exists${NC}" || echo -e "${RED}✗ systemPrompts.ts missing${NC}"

# Test 5: Debug mode test (clean output)
echo -e "\n🔇 Test 5: Testing clean output (no DEBUG)..."
unset DEBUG
export XAI_API_KEY="test"
export GROKCLI_PROVIDER=xai
OUTPUT=$(echo "test" | node dist/index.js -p "say hi" 2>&1 || true)
if echo "$OUTPUT" | grep -q "🚀\|📦\|✅"; then
  echo -e "${RED}✗ Debug logs present without DEBUG=1${NC}"
else
  echo -e "${GREEN}✓ Clean output without DEBUG${NC}"
fi

# Test 6: Error message format
echo -e "\n📣 Test 6: Testing error message format..."
unset XAI_API_KEY
OUTPUT=$(node dist/index.js -p "test" 2>&1 || true)
if echo "$OUTPUT" | grep -q "XAI:"; then
  echo -e "${GREEN}✓ Error messages have provider prefix${NC}"
else
  echo -e "${RED}✗ Error format not standardized${NC}"
fi

# Test 7: Env var support
echo -e "\n🔧 Test 7: Testing env var fallback..."
export GROKCLI_OLLAMA_ENDPOINT="http://test:11434"
export OLLAMA_HOST="http://fallback:11434"
# Just verify it doesn't crash on config
node dist/index.js --version > /dev/null 2>&1 && echo -e "${GREEN}✓ Env var handling works${NC}" || echo -e "${RED}✗ Env var issue${NC}"

echo -e "\n✅ Smoke tests complete!"
EOF

chmod +x test-fixes.sh
./test-fixes.sh
```

---

## Manual Test Checklist

Print this and check off:

```
Critical Fixes:
[ ] Build succeeds
[ ] No duplicate provider error
[ ] Debug logs only show with DEBUG=1
[ ] Requests timeout instead of hanging
[ ] No crashes on malformed JSON
[ ] Both 'xai' and 'grok' provider names work

Medium Priority:
[ ] GROKCLI_OLLAMA_ENDPOINT takes priority
[ ] OLLAMA_HOST fallback works
[ ] Retry logic triggers on 429/5xx
[ ] Known limitations documented

Low Priority:
[ ] No Google/Gemini references in logs
[ ] Error messages have consistent format
[ ] System prompt centralized
[ ] Dependencies documented

General:
[ ] Interactive mode works
[ ] Non-interactive mode works
[ ] XAI provider works with real API key
[ ] Ollama provider works with local instance
[ ] Type checking passes
[ ] Tests pass
```

---

## Real-World Test Scenarios

### Scenario 1: New User Setup

```bash
# Clone repo
git clone https://github.com/stevederico/grok-cli.git
cd grok-cli

# Install and build
npm install
npm run build

# Set up XAI
export XAI_API_KEY="your_key"

# First run
node dist/index.js -p "Hello, test the CLI"

# Should work smoothly without errors
```

### Scenario 2: Switching Providers

```bash
# Start with XAI
export GROKCLI_PROVIDER=xai
export XAI_API_KEY="your_key"
node dist/index.js -p "test xai"

# Switch to Ollama
ollama serve &
export GROKCLI_PROVIDER=ollama
node dist/index.js -p "test ollama"

# Both should work
```

### Scenario 3: Error Recovery

```bash
# Start with wrong config
export XAI_API_KEY="wrong_key"
node dist/index.js -p "test"
# Should show clear error

# Fix it
export XAI_API_KEY="correct_key"
node dist/index.js -p "test"
# Should work now

# Test retry on flaky connection
# Disconnect WiFi temporarily during request
# Should retry and eventually timeout with clear message
```

---

## Debugging Failed Tests

If a test fails:

1. **Enable DEBUG:**
   ```bash
   export DEBUG=1
   ```

2. **Check logs:**
   ```bash
   node dist/index.js -p "test" 2>&1 | tee test.log
   ```

3. **Verify build:**
   ```bash
   npm run clean
   npm run build
   ```

4. **Check file changes:**
   ```bash
   git diff
   ```

5. **Verify env vars:**
   ```bash
   env | grep -i grok
   env | grep -i ollama
   env | grep -i xai
   ```

---

## Success Criteria

All fixes are working if:

✅ Build completes without errors
✅ No duplicate export errors
✅ Clean output without DEBUG=1
✅ Verbose output with DEBUG=1
✅ Requests timeout (don't hang)
✅ Errors have consistent [Provider]: format
✅ Both env var names work (GROKCLI_* and legacy)
✅ Retry logic visible in debug mode
✅ Interactive mode functional
✅ Non-interactive mode functional

---

## Need Help?

If you encounter issues:
1. Check `BUGFIXES.md` for details on specific fix
2. Look at `KNOWN_LIMITATIONS.md` for expected limitations
3. Enable `DEBUG=1` for verbose logging
4. Check dist/ directory exists and has files
5. Verify node version >= 18

---

Last Updated: 2026-01-28
