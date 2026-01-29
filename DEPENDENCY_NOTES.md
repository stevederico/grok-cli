# Dependency Notes - grok-cli

## Dependencies to Review

### @types Packages in `dependencies` (Should be in `devDependencies`)

The following TypeScript type packages are listed in `dependencies` but should be in `devDependencies` since they're only used during development:

```json
"@types/glob": "^8.1.0",
"@types/html-to-text": "^9.0.4",
"@types/update-notifier": "^6.0.8",
```

**Impact:** These packages get bundled with production builds unnecessarily, increasing package size.

**Recommendation:** Move to `devDependencies`:
```bash
npm uninstall @types/glob @types/html-to-text @types/update-notifier
npm install --save-dev @types/glob @types/html-to-text @types/update-notifier
```

---

## Current Dependency Structure

### Production Dependencies (74 total)

**Core Functionality:**
- `ink` + ink plugins - Terminal UI framework
- `react` - Required by Ink
- `yargs` - CLI argument parsing
- `dotenv` - Environment variable loading

**Tools & Utilities:**
- `diff` - File diffing
- `glob` - File pattern matching
- `micromatch` - Advanced pattern matching
- `simple-git` - Git operations
- `shell-quote` - Safe shell command execution

**AI/LLM:**
- `@modelcontextprotocol/sdk` - MCP server support
- `undici` - HTTP client for API calls
- `ws` - WebSocket support

**Rendering:**
- `highlight.js` / `lowlight` - Syntax highlighting
- `html-to-text` - HTML parsing
- `mime-types` - File type detection

**UI Components:**
- `ink-big-text`, `ink-gradient`, `ink-select-input`, `ink-spinner`, `ink-link`, `ink-text-input`

### Development Dependencies (10 total)

**Type Definitions:**
- `@types/*` packages for TypeScript type checking
- `typescript` - TypeScript compiler

**Testing:**
- `vitest` - Test runner
- `@testing-library/react` - React component testing
- `ink-testing-library` - Ink-specific testing
- `jsdom` - DOM implementation for testing

---

## Potential Optimizations

### 1. Remove TypeScript if Not Used

If the codebase is pure JavaScript (as suggested by CLAUDE.md), consider removing TypeScript-related dependencies:

**Current devDependencies:**
```json
"typescript": "^5.3.3",
"@types/command-exists": "^1.2.3",
"@types/diff": "^7.0.2",
"@types/dotenv": "^6.1.1",
"@types/micromatch": "^4.0.8",
"@types/minimatch": "^5.1.2",
"@types/node": "^20.11.24",
"@types/react": "^18.3.1",
"@types/shell-quote": "^1.7.5",
"@types/ws": "^8.5.10",
"@types/yargs": "^17.0.32"
```

**Impact:** Would reduce devDependency count and installation time.

**Consideration:** Keep if using JSDoc type checking or planning to migrate to TypeScript.

---

### 2. Bundle Size Analysis

Run bundle analysis to identify unused dependencies:

```bash
npm install --save-dev webpack-bundle-analyzer
# Or use npm's built-in
npm ls --depth=0
```

Check which dependencies are actually imported in the codebase:

```bash
grep -r "require\|import" packages/cli/src --include="*.js" --include="*.ts" | \
  grep "from ['\"]" | \
  cut -d"'" -f2 | cut -d'"' -f2 | \
  grep -v "^\." | sort | uniq
```

---

### 3. Dependency Duplication

Check for duplicate dependencies across packages:

```bash
npm dedupe
```

---

## Security Audit

Run regular security audits:

```bash
npm audit
npm audit fix
```

---

## Recommendations

### Immediate (Low Risk)
1. ✅ Move `@types/*` from dependencies to devDependencies

### Short-term (Medium Risk)
2. Audit unused dependencies with a tool like `depcheck`:
   ```bash
   npx depcheck
   ```

3. Update outdated packages:
   ```bash
   npm outdated
   npm update
   ```

### Long-term (Requires Testing)
4. Consider removing TypeScript entirely if not used
5. Evaluate if all ink plugins are actually used
6. Consider lighter alternatives:
   - `undici` → native `fetch` (Node 18+)
   - `highlight.js` → on-demand loading only when needed

---

## Version Notes

- **React**: Using v18.3.1 (compatible with Ink 5.x)
- **Node**: Requires >=18 (good - enables native fetch)
- **Ink**: v5.2.0 (latest stable)

---

Last Updated: 2026-01-28
