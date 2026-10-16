# Cross-paragraph Font Selection Implementation Plan

**Goal:** Allow font changes on multiline and cross-paragraph selections from either existing toolbar.

**Architecture:** Reuse the Markdown parser's literal-text source mapping. Apply fonts to selected visible text, retain all block and inline syntax, and leave code and formulas intact. Map existing font span boundaries so replacements and resets preserve other style attributes and unselected text. Submit all changes as one undoable editor transaction, retaining the selection.

**Tech Stack:** TypeScript, markdown-it, CodeMirror, Playwright.

1. Record inline-style source boundaries in `src/inline-style.ts` and map them alongside literal text in `src/text-mapping.ts`.
2. Add a font-selection helper using parser tokens, with updates for existing font spans, partial boundaries, reset, and unchanged source outside the selection.
3. Enable font menus on multiline selections in `src/app.ts`, including hover and the floating toolbar. Keep other menu behavior intact.
4. Check Chrome and Edge: partial first/last paragraphs, soft line breaks, headings/lists/quotes, existing styles and font resets, one-step undo/redo, formula/code preservation, reload and real HTML/Word export. Run existing inline-menu regressions.
5. Update usage notes and the offline HTML/source package with verified checksums.
