ragdoll is an project developed using following technologies:
1. always use kebab-case for filenames.
2. always use camelCase for variables, functions.
3. use PascalCase for classes, interfaces, types.

# Testing for non packages/vscode
We use vitest framework.
our test use vitest framework.
test command: `bun run vitest --run`
coverage test command: `bun run vitest --coverage --run`

## Testing for packages/vscode
We use mocha framework, when creating test, do not use mocks for filesystem, just use vscode.workspace.fs to create files and folders, and only use mocha primitives for testing. use sinon for mocks.

(assuming cwd is packages/vscode)
test command: `bun run test`
coverage test command: `bun run coverage`

# Misc
1. use `bun check` to format / linting the code.
2. use `bun tsc` to check the types.
3. For packages/code it uses `ink` for react terminal ui.
4. Prefer `@/lib` over `../lib` for imports.