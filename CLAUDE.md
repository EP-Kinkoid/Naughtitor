# CLAUDE.md - Naughtitor

## Project Summary

Cross-platform (macOS/Windows) Electron desktop app for SOX audit evidence collection. Auditors organize evidence by **Audit → Control → Application**, capturing screenshots, running live database queries, and importing files as evidence.

**Status:** Feature-complete. Builds and launches successfully. No tests yet.

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop framework | Electron 34 |
| UI | React 19 + TypeScript 5.7 (strict mode) |
| Bundler | esbuild (renderer), tsc (electron main) |
| Screenshots | `screenshot-desktop` (native, cross-platform) |
| Databases | `mysql2` (MySQL), `mssql` (MS SQL), `odbc` (Progress OpenEdge) |
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
  main.ts          Main process: IPC handlers, global hotkey (Ctrl+Shift+S)
  preload.ts       Context bridge → window.naughtitor API
  screenshot.ts    screenshot-desktop wrapper
  database.ts      DB connections: MySQL, MSSQL, OpenEdge (ODBC)
  types.d.ts       Declaration for screenshot-desktop
src/
  App.tsx          Root: AuditSelector or sidebar + main content layout
  index.tsx        React entry point
  index.html       Shell with CSP header
  components/
    AuditSelector     Create/open audits
    ControlList       Add/remove SOX controls
    ApplicationList   Add/remove applications under a control
    EvidenceViewer    Evidence grid + requirements checklist + hotkey
    EvidenceActions   Buttons: Screenshot, DB Query, Import File
    EvidenceCard      Renders any evidence type (screenshot/query/file)
    DbQueryDialog     Modal: DB connection config, SQL editor, results table
  store/
    auditStore.ts  State: currentAudit, selectedControl, selectedApplication, evidence
  types/
    index.ts       All TypeScript types + NaughtitorAPI + global Window decl
  styles/
    global.css     Dark theme, full app styling
build.mjs          esbuild config + static file copy
```

**Data hierarchy:** Audit → Control → Application → Evidence Items

**Data storage:**
```
~/Naughtitor/<audit-name>/
  audit.json                              # { name, controls[{ applications[{ evidenceRequirements[] }] }] }
  <control-id>/
    <app-id>/
      screenshot-<ts>.png                 # Screenshot files
      screenshot-<ts>.json                # Note sidecar
      db-query-<ts>.txt                   # SQL query text
      db-query-<ts>.csv                   # Query results as CSV
      db-query-<ts>.note.json             # Note sidecar for query
      file-<ts>-<original-name>           # Imported file (any type)
      file-<ts>-<original-name>.json      # Note sidecar for file
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
- **IPC safety:** All user inputs validated via `validateName()`, all JSON reads via `readJson()` with fallback, all audit.json writes serialized via write queue
- **No linter/formatter configured** (no ESLint, Prettier)

## Known Bugs

None currently tracked.

## Next TODOs

- [ ] **Tests** - No test framework set up yet. Need:
  - Unit tests for IPC handlers (file operations, JSON read/write)
  - Component tests for React UI
  - Framework: Vitest recommended (fast, TS-native)
- [ ] **Lightbox** - Click screenshot thumbnail to view full-size
- [ ] **Code signing** - electron-builder config has no signing setup for macOS/Windows distribution
- [ ] **Auto-update** - No update mechanism configured
- [ ] **Linux target** - Only macOS (DMG) and Windows (NSIS) configured; no Linux target
- [ ] **Accessibility** - Remove button (`x`) lacks `aria-label`; no keyboard navigation

## Test Scenarios Not Yet Covered

No test framework exists. When added, these scenarios need coverage:

**Electron IPC (unit):**
- Create audit → creates directory + audit.json
- Add control → creates subdirectory, updates audit.json with `applications: []`
- Add application → creates subdirectory under control, updates audit.json
- Capture screenshot → writes PNG to `<control>/<app>/` folder
- Import file → copies file to evidence dir with sanitized name
- Run DB query → connects to DB, saves result JSON to evidence dir
- Test DB connection → validates credentials without saving
- Save/read notes → JSON sidecar files (different paths per evidence type)
- Evidence requirements → add/remove in audit.json, fulfilled check
- Export → creates valid ZIP with nested directory structure
- Path traversal attempts rejected by validateName
- Concurrent writes serialize correctly (write queue)
- Invalid characters in names throw descriptive errors

**React components (unit/integration):**
- AuditSelector: create new audit, open existing audit
- ControlList: add/remove control, select highlights
- ApplicationList: add/remove application, auto-generates safe ID from name
- EvidenceViewer: displays all evidence types, requirements checklist
- EvidenceActions: screenshot/query/file buttons with loading states
- EvidenceCard: renders screenshot vs query vs file differently, note editing
- DbQueryDialog: connection config form, test connection, run query, results table

**E2E:**
- Full flow: create audit → add control → add application → capture screenshot → annotate → export ZIP
- DB query flow: configure connection → test → run query → save results as evidence
- File import flow: open dialog → select file → file copied to evidence dir
- Hotkey capture (Ctrl+Shift+S) triggers screenshot when application is selected
