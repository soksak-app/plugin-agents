# Changelog

[한국어](CHANGELOG.ko.md)

- A1: The repository holds the manifest `plugin.json` with the identifier `agents`, the name, the description and the sections `agents.running` and `agents.definitions`, whose pages `ui/running.html` and `ui/definitions.html` are empty documents until A3 and A4. `test/manifest-shape.test.mjs` checks the declaration, and `test/install.test.mjs` and `test/test-script.test.mjs` check the Makefile and the test command. The version is 0.0.0 and is not released.
- A7: The manifest `plugin.json` declares the extension point `makers` in `extends` with version `0.1.0` and an item schema of the required string fields `id` and `name`. `test/manifest-shape.test.mjs` checks the declaration. Red: `plugin.json declares the extension point agents.makers in extends with its version and schema` failed with `extends` undefined. Green: all 10 tests of `node --test test/` pass, and core `validateManifest` accepts the manifest when run once against the core source.
- A8: The version of the point `makers` in `extends` is `0.0.1`, because the plugin versions stay in the 0.0 series. Red: the version assertion of `test/manifest-shape.test.mjs` failed with `0.1.0`. Green: all 10 tests of `node --test test/` pass, and core `validateManifest` accepts the manifest.
