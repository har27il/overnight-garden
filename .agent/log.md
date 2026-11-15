# Agent log

One entry per task: date, commit, what changed, how it was verified.

## 2026-11-15: grunt helper + README path test (roadmap step 4)

- **Commits:** ffd45c4 (grunt helper), f798fff (test, written by grunt), 757a63d (code-review fixes). Branch chore/grunt-helper.
- **What changed:**
  - `.claude/agents/grunt.md` adds a cheap Haiku helper for small chores, with a fixed five-part report.
  - `test/readme-paths.test.js` fails if README.md names a file git doesn't track (exact case). It checks markdown links, `<img src>` and backticked file names. Home-folder files are skipped. So is a folder that isn't a git checkout.
- **How it was verified:**
  - `npm test` went from 97 of 97 to 98 of 98 passing.
  - With 4 made-up names added to the README (a link, an image, a backticked name, and `readme.md` in the wrong case), the new test failed and named all 4. With the README restored it passed.
  - In a copy with no git folder, the test failed before the fix and skipped after it.
  - Grunt's own log shows 19 replies from claude-haiku-5-5. The main session read the diff and re-ran every check itself.
