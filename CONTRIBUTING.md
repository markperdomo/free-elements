# Contributing

Bug reports, reproducible examples, documentation fixes, and focused pull requests are welcome. [Open an issue](https://github.com/markperdomo/free-elements/issues/new/choose) before starting a large feature to discuss its scope.

## Development

Node.js 20+ runs the dependency-free playground and JavaScript tests. Python 3.10+ runs packaging tools/tests. Native builds additionally require macOS, Xcode command-line tools, and PowerPoint with VBA.

```sh
npm start
npm test
python3 -m unittest discover -s native/tests -p 'test_*.py'
```

See [NATIVE.md](docs/NATIVE.md) for compiling Swift and importing/exporting VBA through PowerPoint. Generated binaries, certificate keys, research payloads, and local validation decks belong under ignored directories.

## Changes

- Preserve separation between the pure JavaScript engine, host adapters, and UI.
- Keep VBA command IDs and the Swift C ABI in agreement.
- Validate input before changing slides and preserve originals for copy operations.
- Add meaningful regression coverage for behavior changes. Describe host version/architecture for live checks; mocks do not prove Office compatibility.
- Contribute only code and assets you have the right to distribute under this project’s license. Preserve required copyright notices, license terms, and attribution. Do not contribute proprietary add-in code, binaries, icons, or slide libraries.
- Keep changes focused and describe behavior, validation, and limitations in the pull request.

Contributions are made under the [MIT license](LICENSE).
