# Selected Multiblock Text Styles Implementation Plan

**Goal:** Support all existing text styles on selected multiline text, without changing unselected text or crossing incompatible block formats.

**Architecture:** Generalize literal-source font edits to property patches. Read existing span styles and native Markdown emphasis, preserve styles outside partial boundaries, and retain the selection in one undoable transaction. Classify parsed block contexts; ordinary paragraphs, same-level headings, same-kind list items, quote paragraphs and lines within one component can each be styled together, while mixed contexts or block code/formulas are rejected without edits.

**Tech Stack:** TypeScript, markdown-it, CodeMirror, MathJax, Playwright.

1. Extend source mapping to native bold/italic/strike and protected inline formula/code runs. Expose block context alongside mapped tokens.
2. Generalize the font helper to selective style patches, uniform selection state, toggles, reset and clear. Every change clips to selected text and restores any affected ancestor style outside that selection.
3. Connect all seven text menus plus bold/italic/underline/wave/strike buttons, preserving individual-property removal, custom color/size, native emphasis and formula-specific controls.
4. Verify selected-only behavior in Chrome and Edge: partial paragraph boundaries, combined styles, native emphasis, same-format lists/quotes/components, mixed-format rejection, clear, undo/redo, reload and clipboard/HTML/Word. Keep desktop-only regression coverage.
5. Update usage notes, prior font tests for the new mixed-format constraint, and verified offline artifacts.
