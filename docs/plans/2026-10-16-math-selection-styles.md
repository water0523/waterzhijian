# Formula Selection Styles Implementation Plan

**Goal:** Apply existing desktop text tools to complete expressions inside inline and display formulas, then publish the verified offline build to GitHub.

**Architecture:** Keep formulas as TeX. Read the exact selected expression and surrounding recognized style commands, update their combined style, and retain the expression selection for consecutive changes. Generate standard MathJax commands for color, bold, italic, underline, strike, highlight and size. Reject incomplete expressions and unsupported text-only effects without changing source. Optional formula rendering remains lazy and offline.

**Tech Stack:** TypeScript, CodeMirror, MathJax SVG, Playwright, esbuild.

1. Extend `src/math-format.ts` with balanced TeX selection validation, recognized wrapper inspection, canonical style generation, removal, and one-step undo. Preserve ordinary Markdown formatting and existing math commands.
2. Connect `src/app.ts` menus and formatting buttons to math selections. Reuse current menus; explain formula limitations there. Fonts, literary roles, half-height brushes, wavy lines and text-only effects remain text-only.
3. Extend `src/math-engine.ts` with safe bbox and enclosure support. Bbox accepts only bounded font sizes and literal colors, never arbitrary CSS or URLs. Existing formula numbering, cache and exports continue unchanged.
4. Add desktop integration checks in `tests/math-selection-styles.mjs`: the user's prime-counting example, successive changes, both toolbars, removal, undo/redo, malformed selections, matrices, ordinary text, saved reload, real clipboard and offline HTML/Word exports. Check Chrome and Edge and inspect day/night screenshots.
5. Run typecheck/build, the new tests and relevant text-format/formula/export regressions. Update usage notes, release package and SHA256 entries, then commit and push `main`, verifying the remote commit.
