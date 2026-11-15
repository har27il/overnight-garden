# Review notes

- `test/readme-paths.test.js` is kept small on purpose: don't flag markdown forms the README doesn't use yet (folder links, `./`, `%20` or `?query` paths, version numbers in code, `~~~` fences). A false alarm fails loudly and names the file, so fix it when it shows up.
