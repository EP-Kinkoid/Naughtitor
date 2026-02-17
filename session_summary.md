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
