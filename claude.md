# Bitrise SDK for React Native

Lightweight React Native SDK for Bitrise Release Management with code push functionality. Production-ready, minimal bundle size, easy integration.

## Tech Stack

- **React Native**: Support latest + 2 previous major versions (0.72+)
- **TypeScript**: 5.0+ with strict mode
- **Node**: 18+ required
- **Expo**: Full support via config plugins
- **Testing**: Jest + React Native Testing Library

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Build
npm run build

# Check bundle size
npm pack && ls -lh *.tgz
```

## Core Principles

### 1. No Extra Files
- **Never create** summary.md, todos.md, notes.md, or similar documentation files
- Code should be self-explanatory through good naming and structure
- Only essential files: source code, tests, package.json, README.md, claude.md
- Use TODO comments in code if needed, not separate files

### 2. Bundle Size Conscious
- **Critical**: Every byte counts when adding to production apps
- Audit every dependency carefully - prefer zero dependencies
- Use tree-shakeable exports (named exports only)
- Measure size impact: `npm pack` before and after changes
- Challenge every addition that increases bundle size

### 3. Production Quality
- Never crash the host app - always fail gracefully
- 80%+ test coverage, 100% for public APIs
- Test on both iOS and Android
- Zero tolerance for memory leaks

### 4. Easy Installation
- Standard npm/yarn: `npm install @bitrise/react-native-sdk`
- Auto-linking support (RN 0.60+)
- Minimal native configuration
- Support Expo managed and bare workflows

## File Structure

```
src/
├── index.ts              # Main export (tree-shakeable)
├── types/                # TypeScript definitions
├── core/                 # Core SDK functionality
├── codepush/             # Code push logic
├── expo/                 # Expo implementations
├── native/               # Native module bridges
└── utils/                # Minimal utilities only
```

## TypeScript Standards

- Strict mode enabled (see tsconfig.json)
- No `any` except when absolutely necessary
- Explicit return types for public APIs
- Prefer interfaces over types for public APIs

## Code Style

- ESLint + Prettier handle all formatting - don't manually enforce style rules
- Let the linters do their job

## Backward Compatibility with react-native-code-push

**Critical Requirement**: Must be backward compatible with [react-native-code-push](https://github.com/CodePushNext/react-native-code-push)

- Support existing CodePush API methods where applicable
- Follow react-native-code-push patterns: `sync()`, `checkForUpdate()`, `notifyAppReady()`
- Use similar method names and signatures
- Migration should require minimal code changes
- Document migration guide in README.md

## Testing Requirements

- Minimum 80% coverage, 100% for public APIs
- Test both iOS and Android code paths
- Test error cases and edge cases
- Mock native modules appropriately
- Use Arrange-Act-Assert pattern
- Keep mocks simple and maintainable

## Workflows

### Adding New Features
1. Check bundle size impact first
2. Consider backward compatibility
3. Write tests first (TDD)
4. Implement feature
5. Verify tests pass
6. Check bundle size after: `npm pack`

### Bug Fixes
1. Write failing test that reproduces bug
2. Fix the bug
3. Verify test passes
4. Ensure no regression in other tests

### Before Commits
- Tests pass: `npm test`
- Types check: `npm run typecheck`
- Linting passes: `npm run lint`

## Error Handling

- **Never crash the host app** - this is critical
- Use Error subclasses for different error types (see src/errors.ts)
- Log errors clearly for debugging
- Provide actionable error messages
- Return meaningful error codes

## Bundle Size Guidelines

- No large dependencies (lodash, moment, etc.)
- Use React Native's built-in APIs
- Tree-shakeable exports only
- No unnecessary polyfills
- Monitor with `npm pack` and `source-map-explorer`
- Consider feature flags or optional modules for large features

## Documentation

### Inline Documentation
- JSDoc for all public APIs
- Explain "why", not "what"
- Include usage examples in JSDoc
- Document breaking changes in README.md only

### README.md Should Include
- Quick start guide (< 5 minutes)
- Installation for both standard RN and Expo
- Basic usage examples
- Migration guide from react-native-code-push
- Troubleshooting section

## API Design

- Keep public API surface small and focused
- Make common tasks easy, complex tasks possible
- Consistent naming across SDK
- Async by default for network operations
- Backward compatible changes only (or major version bump)
- Sensible defaults (zero config should work)
- Validate configuration early with clear error messages

## Expo Support

- Support managed workflow via config plugins
- Support bare workflow natively
- Test with EAS Build
- Minimize native code requirements
- Auto-configure native modules when possible

## Security

- Never log sensitive data (tokens, keys)
- Validate all external input
- Use HTTPS for all network requests
- Support secure storage (Keychain/Keystore) for tokens
- Never bundle tokens in the app
- Regular dependency audits: `npm audit`

## Native Code

- Minimize native code - prefer JavaScript/TypeScript
- Use TurboModules/New Architecture when stable
- Support both old and new architecture during transition
- Auto-linking required
- Handle iOS/Android differences gracefully with Platform.select()

## Release Process

### Pre-release Checklist
- [ ] All tests passing
- [ ] TypeScript compiles with no errors
- [ ] Linting passes
- [ ] Bundle size checked and acceptable
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped (follow semver strictly)

### Versioning (Semantic Versioning)
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes only

## Quick Reference

**Always:**
- Keep bundle size minimal
- Test thoroughly (80%+ coverage)
- Maintain backward compatibility
- Never crash host app
- Let linters handle formatting

**Never:**
- Create extra .md files
- Add large dependencies without justification
- Skip tests
- Break APIs without major version bump
- Log sensitive data
