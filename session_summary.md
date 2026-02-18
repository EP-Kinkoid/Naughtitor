# Naughtitor Session Summary - 2026-02-17

## What Was Built

Naughtitor is a cross-platform (macOS/Windows) Electron desktop app for SOX audit evidence collection. Built from scratch in a single session.

### Initial MVP
- Electron 34 + React 19 + TypeScript (strict mode)
- Create/open audits, manage SOX controls, capture screenshots, annotate with notes, export as ZIP
- Dark theme UI with sidebar (controls) + main content (evidence grid)
- Global hotkey: Ctrl+Shift+S for screenshot capture
- Evidence stored locally at `~/Naughtitor/<audit>/<control>/`
- Built with esbuild (renderer) + tsc (electron main)
- Packaging via electron-builder (DMG on Mac, NSIS on Windows)

### Bug Fixes Applied
1. **Path traversal vulnerability** - Added `validateName()` rejecting `..`, special chars, enforcing safe names
2. **JSON parse crashes** - Replaced bare `JSON.parse` with `readJson()` helper with fallback
3. **Race conditions** - Added serialized write queue per audit for `audit.json` mutations
4. **Sync I/O blocking** - Migrated all file ops from `fs.*Sync` to `fs.promises`
5. **Input validation errors silent** - Added try-catch in UI components, red error messages displayed inline

### Application Layer + Multi-Type Evidence
Extended hierarchy from Audit → Control → Evidence to **Audit → Control → Application → Evidence**.

**New evidence types:**
- **Screenshots** - Same as before (PNG files)
- **Database queries** - Live connections to MySQL, MS SQL, Progress OpenEdge (ODBC). Saves as `.txt` (query) + `.csv` (results)
- **File imports** - Copy any file from disk into evidence folder

**New components:**
- `ApplicationList` - Add/remove/select applications under controls
- `EvidenceActions` - Three buttons: Screenshot, DB Query, Import File
- `EvidenceCard` - Renders all evidence types with type-specific previews
- `DbQueryDialog` - Modal with connection config, SQL editor, results table preview

**Evidence requirements checklist** - Define expected evidence items per application (label + type), auto-marks as fulfilled.

**New dependencies:** `mysql2`, `mssql`, `odbc`, `@types/mssql`

### Data Storage Format
```
~/Naughtitor/<audit>/
  audit.json
  <control-id>/
    <app-id>/
      screenshot-<ts>.png / .json (note)
      db-query-<ts>.txt (SQL) / .csv (results) / .note.json (note)
      file-<ts>-<name> / .json (note)
```

### Repo
GitHub: https://github.com/EP-Kinkoid/Naughtitor (2 commits pushed)

### What's NOT Done Yet
- No tests (no test framework configured)
- No lightbox for full-size screenshot viewing
- No code signing or auto-update
- No Linux target
- No accessibility improvements (aria-labels, keyboard nav)

---

# Session Summary - 2026-02-18

## What Was Done

Full architectural pivot of Naughtitor from an audit-centric tool to a **system documentation + audit evidence tool**.

### Key Changes

1. **New Data Model** (`src/types/index.ts`)
   - `AppRecord`: Rich application metadata (name, description, userBase, authMethod, authorizationMethod, provisioningProcess, environment, dbConfig)
   - `ControlRecord`: SOX controls with `appIds[]` (many-to-many link to apps)
   - `AuditRecord`: Audit periods with `controlApps[]` (scoped control+app pairs, each with `evidenceRequirements[]`)
   - `Registry`: Single top-level structure containing `applications[]`, `controls[]`, `audits[]`

2. **Electron Main Process** (`electron/main.ts`) - Full rewrite
   - New IPC handlers for all CRUD: create/update/archive apps, controls, audits
   - Control-app linking/unlinking
   - Audit scope management (add/remove control+app pairs)
   - Evidence requirements (add/remove per audit+control+app)
   - `archive-evidence` replaces `delete-evidence` (writes `.archived` marker sidecar)
   - `list-all-evidence-for-app` scans across all audit directories
   - Evidence directory changed to `~/Naughtitor/evidence/<audit>/<control>/<app>/`
   - All registry writes serialized via write queue

3. **Preload Bridge** (`electron/preload.ts`) - Full rewrite
   - Maps all new IPC channels to `window.naughtitor` API

4. **State Management**
   - New `useRegistryStore` hook: loads registry, exposes all CRUD operations
   - New `useEvidenceStore` hook: loads evidence for a given (audit, control, app) triple
   - Deleted old `useAuditStore`

5. **UI Components**
   - **NavBar**: Top-level navigation (Home, Applications, Controls, Audits)
   - **HomeView**: Summary dashboard with counts of active entities, recent items
   - **ApplicationsView**: Split-panel with app list + detail form (metadata fields, dropdowns for auth/environment) + evidence history tab
   - **ControlsView**: Split-panel with control list + detail (description editing, app linking/unlinking)
   - **AuditsView**: Audit list with create form and archive toggle
   - **AuditWorkspace**: Sidebar scope tree + evidence collection workspace using EvidenceViewer
   - **ArchiveToggle**: Shared checkbox component for showing/hiding archived items
   - Updated: EvidenceViewer, EvidenceCard, EvidenceActions, DbQueryDialog (prop changes for new model)
   - Deleted: AuditSelector, ControlList, ApplicationList

6. **CSS** (`src/styles/global.css`) - Full rewrite
   - New layout: `.app-shell`, `.nav-bar`, `.entity-split-view`, `.audit-workspace`
   - Form styling, tabs, scope tree, archive badges
   - Dark theme maintained

7. **Documentation**
   - CLAUDE.md updated with new architecture, data model, file structure, test scenarios

### Migration Strategy
Clean break - no automated migration. Old `~/Naughtitor/<audit>/` directories left on disk. New data starts fresh with `registry.json`.

### Build Status
- `npm run build` compiles successfully (zero errors)
- `npm run dev` launches the Electron app successfully

### Runtime Errors Observed
When testing the running app, `create-audit` and `create-control` handlers rejected names with characters not matching `[a-zA-Z0-9 _\-\.]` - this is the `validateName` function working as designed, but the UI may need to sanitize/slugify input before sending to IPC.

### Verification (Not Yet Performed)
1. Create an application with all metadata fields populated
2. Create a control and link the application to it
3. Create an audit, add the control+app pair to scope
4. Collect all three evidence types (screenshot, DB query, file import)
5. Verify evidence appears in both Audit view and Application view
6. Archive an evidence item - verify hidden by default, visible with toggle
7. Export audit as ZIP - verify file structure
