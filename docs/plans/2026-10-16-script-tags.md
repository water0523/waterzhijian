# Upper and Lower Script Tag Rendering Fix

**Goal:** Render `<sup>[[1]](https://example.com/source)</sup>` as a clickable superscript citation without changing the source article.

Keep raw HTML disabled. Recognize only paired, attribute-free `sup` and `sub` tags through the inline parser, with Markdown links, emphasis and existing inline styles parsed inside them. Keep code, escaped tags, unclosed tags, unknown tags and tag attributes literal. Preserve source offsets for preview editing and selected-only styles. Use explicit inline script sizing/alignment for publication and retain native script text in Word.

Verify the reported citation in desktop Chrome and Edge, nested/adjacent/empty tags, code and literal isolation, unsafe input, editable source mapping, theme changes, day/night, reload, clipboard, independent HTML and Word. Rebuild both offline entrypoints and the Pages copy, then package the updated source and test evidence.
