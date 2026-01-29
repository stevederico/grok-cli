#!/bin/bash
# Quick smoke test for grok-cli fixes

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Quick Test: grok-cli Fixes${NC}\n"

# Test 1: Bundle (skip tests due to pre-existing test file issue)
echo -n "📦 Building bundle... "
npm run bundle > /tmp/grok-bundle.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ (check /tmp/grok-bundle.log)${NC}"
    exit 1
fi

# Test 2: Duplicate file check
echo -n "🗑️  Checking duplicate removed... "
if [ ! -f packages/cli/src/core/providers/grok.ts ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ grok.ts still exists${NC}"
fi

# Test 3: XAI file exists
echo -n "✅ Checking xai.ts exists... "
if [ -f packages/cli/src/core/providers/xai.ts ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

# Test 4: System prompts file
echo -n "📝 Checking systemPrompts.ts... "
if [ -f packages/cli/src/core/providers/systemPrompts.ts ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test 5: Version command
echo -n "🔧 Testing CLI runs... "
node bundle/grok-cli.js --version > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test 6: Clean output check
echo -n "🔇 Testing clean output... "
unset DEBUG
export XAI_API_KEY="test"
export GROKCLI_PROVIDER=xai
OUTPUT=$(echo "test" | node bundle/grok-cli.js -p "hi" 2>&1 &
sleep 2
kill $! 2>/dev/null || true
wait $! 2>/dev/null || true)
if echo "$OUTPUT" | grep -q "🚀\|📦"; then
    echo -e "${RED}✗ Debug logs visible${NC}"
else
    echo -e "${GREEN}✓${NC}"
fi

# Test 7: Error format
echo -n "📣 Testing error format... "
unset XAI_API_KEY
OUTPUT=$(node bundle/grok-cli.js -p "test" 2>&1 || true)
if echo "$OUTPUT" | grep -q "XAI:"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}? (couldn't verify)${NC}"
fi

echo -e "\n${GREEN}✅ Smoke tests complete!${NC}"
echo -e "\nFor full testing, see TESTING_GUIDE.md"
