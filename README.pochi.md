ragdoll is an project developed using following technologies:
1. always use kebab-case for filenames.
2. always use camelCase for variables, functions.
3. use PascalCase for classes, interfaces, types.

# Testing
our test use vitest framework.
test command: `bun run vitest --run`
coverage test command: `bun run vitest --coverage --run`

# Misc
1. use `bun check` to format / linting the code.
2. use `bun tsc` to check the types.
3. For packages/code it uses `ink` for react terminal ui.
4. Prefer `@/lib` over `../lib` for imports.