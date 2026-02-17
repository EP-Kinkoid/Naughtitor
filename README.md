# Naughtitor

SOX Audit Evidence Collection App - a cross-platform (Windows/macOS) desktop GUI for capturing and organizing screenshot evidence during IT controls audits.

## Features

- **Create/Open Audits** - Name audit engagements (e.g., "FY2026 Q1 Audit")
- **Manage Controls** - Add SOX control numbers (e.g., "ITGC-01", "AC-3.2") with descriptions
- **Capture Screenshots** - Click capture or use hotkey (Ctrl+Shift+S) to save screenshots
- **Browse Evidence** - View captured screenshots per control with timestamps
- **Annotate** - Add text notes to any screenshot
- **Export** - Package audit evidence into a ZIP for sharing

## Evidence Storage

Screenshots are stored locally at:
```
~/Naughtitor/
  <audit-name>/
    <control-number>/
      screenshot-2026-02-17T10-30-00.png
      ...
```

## Development

```bash
npm install
npm run dev        # Build and launch the app
npm run build      # Build without launching
npm run dist       # Package for distribution
```

## Tech Stack

- Electron - Cross-platform desktop framework
- React + TypeScript - UI
- screenshot-desktop - Native screenshot capture
- archiver - ZIP export
