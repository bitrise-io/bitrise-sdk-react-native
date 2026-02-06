# Contributing to Bitrise SDK for React Native

Thanks for your interest in contributing!

## Quick Start

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Make your changes
5. Submit a pull request

## Development Commands

```bash
npm install        # Install dependencies
npm test           # Run tests
npm run typecheck  # TypeScript validation
npm run lint       # ESLint checks
npm run build      # Build the SDK
npm pack           # Check bundle size
```

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` except when absolutely necessary
- Explicit return types for public APIs

### Testing

- Minimum 80% coverage, 100% for public APIs
- Test both iOS and Android code paths
- Use Arrange-Act-Assert pattern

### Bundle Size

Every byte counts in a production SDK:

1. Run `npm pack` before and after changes
2. Avoid adding new dependencies
3. Use tree-shakeable exports only
4. Report size impact in your PR

## Pull Request Checklist

- [ ] Tests pass: `npm test`
- [ ] Types check: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Bundle size impact documented
- [ ] README.md updated (if adding features)

## Backward Compatibility

This SDK maintains compatibility with react-native-code-push:

- Support existing API method signatures
- Avoid breaking changes without major version bump
- Document migration paths for changes

## Error Handling

- Never crash the host app
- Use Error subclasses from `src/errors.ts`
- Provide actionable error messages

## Questions?

Open an issue before starting large changes.
