---
name: Mockup screenshot HMR blanks
description: Why mockup-sandbox preview screenshots sometimes come back blank, and how to react.
---

When screenshotting the mockup-sandbox preview (`/__mockup/preview/...`) right after editing a
component, the external_url screenshot can capture the page mid-HMR-reload and return a fully blank
(white) image. Runtime errors referencing an old symbol (e.g. a just-removed import) in the workflow
logs are usually STALE — they came from intermediate HMR states between sequential edits, not the
final file.

**Why:** edits land as several HMR updates; a capture (or asset page-reload after deleting an
imported file) can land during the transient reload window.

**How to apply:** before assuming the app is broken, (1) grep the file to confirm no real stale refs,
(2) confirm the imported asset exists, (3) re-capture with a fresh cache-buster. If the code is clean,
a second/third capture renders correctly. Don't "fix" code based on a single blank screenshot.
