# Naughtitor Progress Log

## 2026-02-17 - Initial Build + Application Layer

### Completed
- Created full Electron + React + TypeScript project from scratch
- Implemented audit/control/application hierarchy with evidence collection
- Three evidence types: screenshots, live DB queries (MySQL/MSSQL/OpenEdge), file imports
- Evidence requirements checklist with auto-fulfillment detection
- DB query results stored as `.txt` (query) + `.csv` (results) instead of JSON
- Fixed path traversal, JSON parse crashes, race conditions, sync I/O blocking
- Added inline error messages for invalid input (special characters in names)
- CLAUDE.md populated with full project context
- Pushed to GitHub: https://github.com/EP-Kinkoid/Naughtitor

### Outstanding
- No test framework or tests
- No lightbox, code signing, auto-update, Linux target, accessibility

## 2026-02-18 - Pivot to System Documentation + Audit Evidence Tool

### Completed
- **Full architectural pivot**: Rewrote app from audit-centric to system documentation tool with three independent top-level entities (Applications, Controls, Audits)
- **New data model**: `AppRecord` (rich metadata: auth, environment, DB config), `ControlRecord` (SOX controls with `appIds[]` many-to-many), `AuditRecord` (periods with `controlApps[]` scope)
- **Single `registry.json`** replaces per-audit JSON files; evidence moves under `~/Naughtitor/evidence/`
- **Rewrote `electron/main.ts`**: New IPC handlers for all CRUD operations (app/control/audit create/update/archive, link/unlink, requirements, evidence)
- **Rewrote `electron/preload.ts`**: New context bridge matching all IPC channels
- **New state layer**: `useRegistryStore` (registry CRUD) + `useEvidenceStore` (evidence loading) replace old `useAuditStore`
- **New UI components**: NavBar, HomeView (summary dashboard), ApplicationsView (metadata form + evidence history tab), ControlsView (description + app linking), AuditsView + AuditWorkspace (scope management + evidence collection)
- **Archive mechanism**: Soft-delete via `archived: boolean` flag on entities, `.archived` marker sidecar files for evidence, `ArchiveToggle` component
- **Cross-references**: `list-all-evidence-for-app` scans across all audit dirs; evidence history tab on ApplicationsView
- **Full CSS rewrite**: New layout classes for nav, split-panel views, forms, scope tree, tabs
- **Updated CLAUDE.md** with new architecture documentation
- **Clean break migration**: No automated migration from old format
- Build compiles successfully, app launches with `npm run dev`

### Files Changed
- **Replaced**: `src/types/index.ts`, `electron/main.ts`, `electron/preload.ts`, `src/App.tsx`, `src/styles/global.css`
- **New**: `NavBar.tsx`, `HomeView.tsx`, `ApplicationsView.tsx`, `ControlsView.tsx`, `AuditsView.tsx`, `AuditWorkspace.tsx`, `ArchiveToggle.tsx`, `registryStore.ts`, `evidenceStore.ts`
- **Updated**: `EvidenceViewer.tsx`, `EvidenceCard.tsx`, `EvidenceActions.tsx`, `DbQueryDialog.tsx`
- **Deleted**: `AuditSelector.tsx`, `ControlList.tsx`, `ApplicationList.tsx`, `auditStore.ts`

### Outstanding
- Manual verification of full workflow (create app → control → audit → collect evidence → export)
- No test framework or tests
- No lightbox, code signing, auto-update, Linux target, accessibility
