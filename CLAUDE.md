# Voice Orchestrator

TypeScript (strict, ESM, NodeNext) on Node ≥ 22, run with `tsx`. See README.md for what the app does.

- Type-check: `npm run typecheck`
- Lint: `npm run lint` (oxlint, type-aware; rules in `.oxlintrc.json`)
- Format: `npx prettier --write <files>` (`.prettierrc.json`)
- Tests: `npm test` (`node:test`, runs `src/**/*.test.ts`; test files sit next to the code they test)

## Code Generation Rules

General clean-code rules come from the user's global CLAUDE.md, and the linter enforces typing, promise and error rules.
These are the project-specific additions.

- Size limits: files ≤ 200 lines, classes ≤ 60 lines, functions ≤ 20 lines (aim for ≤ 15), ≤ 3 parameters, ≤ 3 levels of nesting.
- If a file you touch is already over a limit, don't grow it: put new code in a new module.
- Before finishing, run Prettier and `npx oxlint --type-aware <files>` on the files you changed and fix every error there,
  then run `npm run typecheck` and `npm test`. Report any failures.
- Validate anything from outside the process (config, `state/` files, HTTP requests, SDK and child-process output)
  with a `zod` schema at the boundary, and derive the type with `z.infer`.
- Build collaborators in `main.ts` or a factory and pass them in. Relative imports end in `.js`.
- Tests use `node:assert/strict`, temp directories (`mkdtempSync`) instead of real `state/` or `config/` files, and no network.
- Refactors keep behavior identical, including spoken and logged messages and the file formats in `state/`.
  Don't mix a refactor with a behavior change, and run the tests before and after.
