# pendant

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

## Development

To build the project:

```bash
bun run build
```

To run tests:

```bash
bun test
```

To run linting:

```bash
bun run lint
```

## Building for Distribution

This project uses GitHub Actions to automatically build standalone executables for multiple platforms when a release is created. The following platforms are supported:

- Windows x86-64
- macOS x86-64 (Intel)
- macOS ARM64 (Apple Silicon)
- Ubuntu x86-64
- Ubuntu ARM64

### Creating a Release

1. Create a new release on GitHub
2. The release workflow will automatically build binaries for all supported platforms
3. The binaries will be attached to the release as downloadable assets

### Manual Build

To build a standalone executable locally:

```bash
# Build the project first
bun run build

# Create standalone executable
bun build src/index.ts --compile --outfile=pendant
```

This project was created using `bun init` in bun v1.2.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
