# CLAUDE.md - Naughtitor

## Project Summary

Cross-platform (macOS/Windows) Electron desktop app for **system documentation and SOX audit evidence collection**. Three independent top-level entities: **Applications** (rich metadata), **Controls** (SOX controls linked to apps), and **Audits** (periodic evidence collection periods). Three navigation views plus a home dashboard.

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
| State mgmt | React hooks only (`useRegistryStore` + `useEvidenceStore`) |

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
  App.tsx          Root: NavBar + view routing (home/applications/controls/audits)
  index.tsx        React entry point
  index.html       Shell with CSP header
  components/
    NavBar            Top-level navigation: Home, Applications, Controls, Audits
    HomeView          Landing page with summary cards
    ApplicationsView  App list + detail panel (metadata form, evidence history tab)
    ControlsView      Control list + detail (description, linked apps picker)
    AuditsView        Audit list + create
    AuditWorkspace    Audit scope tree + evidence collection workspace
    ArchiveToggle     Shared archive toggle widget
    EvidenceViewer    Evidence grid + requirements checklist + hotkey
    EvidenceActions   Buttons: Screenshot, DB Query, Import File
    EvidenceCard      Renders any evidence type (screenshot/query/file)
    DbQueryDialog     Modal: DB connection config, SQL editor, results table
  store/
    registryStore.ts  State: Registry (apps, controls, audits), all CRUD operations
    evidenceStore.ts  State: evidence items for a given (audit, control, app) triple
  types/
    index.ts       All TypeScript types + NaughtitorAPI + global Window decl
  styles/
    global.css     Dark theme, full app styling
build.mjs          esbuild config + static file copy
```

**Data model:** Three independent entities linked via IDs:
- `AppRecord` - rich application metadata (auth, environment, DB config, etc.)
- `ControlRecord` - SOX control with `appIds[]` (many-to-many link to apps)
- `AuditRecord` - audit period with `controlApps[]` (which control+app pairs are in scope)

**Data storage:**
```
~/Naughtitor/
  registry.json                          # Single source of truth for all entities
  evidence/
    <audit-id>/
      <control-id>/
        <app-id>/
          screenshot-<ts>.png / .json    # Screenshot + note sidecar
          db-query-<ts>.txt / .csv / .note.json  # Query text, results, note
          file-<ts>-<name> / .json       # Imported file + note sidecar
          <filename>.archived            # Soft-delete marker sidecar
```

**Archive mechanism:** Entities have `archived: boolean` flag in registry.json. Evidence uses `.archived` marker files. Archived items hidden by default, shown via toggle.

## Code Style & Conventions

- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** Yes
- **File naming:** PascalCase for components (`ApplicationsView.tsx`), camelCase for modules (`registryStore.ts`)
- **Variables/functions:** camelCase
- **Types/interfaces:** PascalCase (`AppRecord`, `EvidenceItem`)
- **Constants:** SCREAMING_SNAKE_CASE (`NAUGHTITOR_DIR`)
- **Component props:** Always `interface Props` (not exported)
- **Exports:** Named exports (`export function App()`)
- **React:** Functional components + hooks only, no class components
- **IPC safety:** All user inputs validated via `validateName()`, all JSON reads via `readJson()` with fallback, all registry.json writes serialized via write queue
- **No linter/formatter configured** (no ESLint, Prettier)

## Known Bugs

None currently tracked.

## Next TODOs

- [ ] **Tests** - No test framework set up yet. Need:
  - Unit tests for IPC handlers (registry CRUD, evidence operations)
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
- Create app → adds to registry.json with full metadata
- Update app → modifies fields in registry.json
- Archive app → sets archived flag in registry.json
- Create control → adds to registry.json with empty appIds
- Link/unlink app to control → updates appIds array
- Create audit → adds to registry.json with slugified ID
- Add/remove audit control-app → updates controlApps array
- Capture screenshot → writes PNG to evidence/<audit>/<control>/<app>/
- Import file → copies file to evidence dir with sanitized name
- Run DB query → connects to DB, saves CSV + TXT to evidence dir
- Test DB connection → validates credentials without saving
- Save/read notes → JSON sidecar files (different paths per evidence type)
- Evidence requirements → add/remove in audit controlApps entry
- Archive evidence → writes .archived marker sidecar
- List evidence → excludes files with .archived markers
- List all evidence for app → scans across all audit dirs
- Export → creates valid ZIP from evidence/<audit-id>/ directory
- Path traversal attempts rejected by validateName
- Concurrent writes serialize correctly (write queue)
- Invalid characters in names throw descriptive errors

**React components (unit/integration):**
- HomeView: summary cards, navigation links
- ApplicationsView: create/edit app, metadata form, evidence history tab
- ControlsView: create control, link/unlink apps
- AuditsView: create audit, select opens workspace
- AuditWorkspace: add/remove scope, evidence collection
- EvidenceViewer: displays all evidence types, requirements checklist
- EvidenceActions: screenshot/query/file buttons with loading states
- EvidenceCard: renders screenshot vs query vs file differently, note editing, archive
- DbQueryDialog: connection config form, test connection, run query, results table

**E2E:**
- Full flow: create app → create control → link app → create audit → add scope → collect evidence → export ZIP
- DB query flow: configure connection → test → run query → save results as evidence
- File import flow: open dialog → select file → file copied to evidence dir
- Hotkey capture (Ctrl+Shift+S) triggers screenshot when app is selected
- Archive flow: archive evidence → verify hidden → toggle show archived → verify visible
