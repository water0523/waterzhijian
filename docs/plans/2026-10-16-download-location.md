# Download Location Implementation Plan

**Goal:** Let desktop users reveal an exported download in its actual folder while preserving normal browser downloads.

**Architecture:** Keep the standalone web app. Offer an optional Manifest V3 companion with only the downloads permission. Match each exported blob URL to its real browser download ID, including renamed duplicates and custom download destinations, then call downloads.show on a user click. Never guess Windows paths or label an in-page file picker as opening Explorer. Without the helper, keep normal downloads and show one-time setup. Browser-printed PDFs have no download ID: offer the default download folder with an explicit custom-location limitation.

**Tech Stack:** TypeScript, existing offline build/ZIP tools, Chrome/Edge extension APIs, Playwright desktop tests.

1. Add a restricted content bridge and background handler: exact app origin/marker, blob URL validation, per-request IDs, no arbitrary paths or download IDs, no remote requests, no file opening/deletion. Allow only status/reveal and default-folder actions.
2. Add a compact dismissible download notice and an export-menu entry. Show the actual download state and enable reveal only after completion. Handle missing extension, interruption, moved files and disconnected helpers without breaking downloads.
3. Add an offline helper ZIP with setup instructions. PDF controls distinguish the default directory from the unknown print-save location.
4. Verify real Edge extension loading, real downloads and exact ID matching; spy on the final OS reveal call to avoid opening Explorer during automated tests. Verify no-helper UI in Chrome and Edge, unsafe messages, export regressions and day/night. Package evidence and updated offline entrypoints.
