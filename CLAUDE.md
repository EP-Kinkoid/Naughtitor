# CLAUDE.md - Naughtitor

## Project Summary

Cross-platform (macOS/Windows) Electron desktop app for SOX audit evidence collection. Auditors capture screenshots, organize them by SOX control number, annotate with notes, and export as ZIP.

**Status:** MVP complete. Builds and launches successfully. No tests yet.

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop framework | Electron 34 |
| UI | React 19 + TypeScript 5.7 (strict mode) |
| Bundler | esbuild (renderer), tsc (electron main) |
| Screenshots | `screenshot-desktop` (native, cross-platform) |
| Export | `archiver` (ZIP) |
| Packaging | `electron-builder` (DMG on Mac, NSIS on Windows) |
| State mgmt | React hooks only (`useAuditStore` custom hook) |

## Commands

```bash
npm run dev              # Build everything + launch Electron
npm run build            # Compile electron + renderer
npm run build:electron   # Compile electron/ only
npm run build:renderer   # Compile src/ + esbuild bundle
npm run pack             # Package without installer (test)
npm run dist             # Create distributable (DMG/NSIS)
```

## Architecture

```
electron/
  main.ts          Main process: window, 14 IPC handlers, global hotkey
  preload.ts       Context bridge → window.naughtitor API
  screenshot.ts    screenshot-desktop wrapper
  types.d.ts       Declaration for screenshot-desktop (no @types available)
src/
  App.tsx          Root: routes between AuditSelector and main layout
  index.tsx        React entry point (createRoot)
  index.html       Shell with CSP header
  components/
    AuditSelector  Create/open audits
    ControlList    Add/remove SOX controls
    EvidenceViewer Screenshot grid + hotkey listener (Ctrl+Shift+S)
    CaptureButton  Triggers screenshot capture via IPC
    ScreenshotCard Displays screenshot with timestamp, notes, delete
  store/
    auditStore.ts  Custom hook: currentAudit, selectedControl, evidence state
  types/
    index.ts       AuditMeta, Control, EvidenceItem, NaughtitorAPI (+ global Window decl)
  styles/
    global.css     Dark theme, full app styling
build.mjs          esbuild config + static file copy
```

**Build output:** `dist/electron/` (CommonJS) and `dist/renderer/` (IIFE bundle + HTML + CSS)

**Data storage:**
```
~/Naughtitor/<audit-name>/
  audit.json                     # { name, controls[], createdAt }
  <control-id>/
    screenshot-<timestamp>.png   # Screenshot files
    screenshot-<timestamp>.json  # Note sidecar { note, updatedAt }
```

## Code Style & Conventions

- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** Yes
- **File naming:** PascalCase for components (`AuditSelector.tsx`), camelCase for modules (`auditStore.ts`)
- **Variables/functions:** camelCase
- **Types/interfaces:** PascalCase (`AuditMeta`, `EvidenceItem`)
- **Constants:** SCREAMING_SNAKE_CASE (`NAUGHTITOR_DIR`)
- **Component props:** Always `interface Props` (not exported)
- **Exports:** Named exports (`export function App()`)
- **React:** Functional components + hooks only, no class components
- **No linter/formatter configured** (no ESLint, Prettier)

## Known Bugs

1. **Path traversal vulnerability** - Control IDs are not validated. A malicious control ID like `../../etc` could write files outside `~/Naughtitor/`. Need to sanitize to alphanumeric + `-_.` only.
2. **No JSON parse error handling** - `electron/main.ts` has ~5 bare `JSON.parse()` calls. Corrupted `audit.json` crashes the app. Needs try-catch wrappers.
3. **Race conditions on audit.json** - No file locking. Concurrent IPC calls (e.g., rapid control add/remove) could corrupt data. Needs a write queue or mutex.
4. **Sync I/O on main thread** - `fs.readFileSync`/`writeFileSync` calls can block the renderer during large operations. Should migrate to async `fs.promises`.

## Next TODOs

- [ ] **Input validation** - Sanitize audit names and control IDs (restrict characters, limit length)
- [ ] **Error handling** - Wrap all JSON.parse and fs operations in try-catch, surface errors to UI
- [ ] **Tests** - No test framework set up yet. Need:
  - Unit tests for IPC handlers (file operations, JSON read/write)
  - Component tests for React UI
  - Framework: Vitest recommended (fast, TS-native)
- [ ] **Lightbox** - Click screenshot thumbnail to view full-size
- [ ] **Code signing** - electron-builder config has no signing setup for macOS/Windows distribution
- [ ] **Auto-update** - No update mechanism configured
- [ ] **Linux target** - Only macOS (DMG) and Windows (NSIS) configured; no Linux target
- [ ] **Accessibility** - Remove button (`x`) lacks `aria-label`; no keyboard navigation for control list

## Test Scenarios Not Yet Covered

No test framework exists. When added, these scenarios need coverage:

**Electron IPC (unit):**
- Create audit → creates directory + audit.json
- Add control → creates subdirectory, updates audit.json
- Remove control → deletes directory recursively, updates audit.json
- Capture screenshot → writes PNG to correct control folder
- Save/read notes → JSON sidecar files
- Export → creates valid ZIP with correct structure
- List audits → returns only directories under ~/Naughtitor
- Duplicate control IDs are rejected (currently silently skipped)
- Malformed audit.json recovery

**React components (unit/integration):**
- AuditSelector: create new audit, open existing audit
- ControlList: add control, remove control with confirmation, select control highlights
- EvidenceViewer: displays screenshots, responds to hotkey
- ScreenshotCard: add/edit note, delete with confirmation
- CaptureButton: shows loading state, handles errors

**E2E:**
- Full flow: create audit → add control → capture screenshot → view → annotate → export ZIP
- Hotkey capture (Ctrl+Shift+S) triggers screenshot when control is selected
