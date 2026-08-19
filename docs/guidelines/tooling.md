# Tooling (lint / format)

Local quality gate for Irecon Insurance (Phase 8). CI should re-run the same commands — hooks alone are not enough.

## Commands

| Command                | What                                                   |
| ---------------------- | ------------------------------------------------------ |
| `npm run lint`         | ESLint flat config                                     |
| `npm run lint:fix`     | ESLint with `--fix`                                    |
| `npm run format`       | Prettier write (incl. Tailwind class sort)             |
| `npm run format:check` | Prettier check                                         |
| `npm run typecheck`    | React Router typegen + `tsc` (TypeScript **7** native) |
| `npm run test:unit`    | Vitest unit                                            |
| `npm run verify`       | lint + format:check + typecheck + test:unit            |

## Config files

- `eslint.config.js` — flat ESLint (`typescript-eslint` + `react-hooks` + Prettier disable)
- `prettier.config.js` + `.prettierignore` — Prettier + `prettier-plugin-tailwindcss`
- `.editorconfig` — charset / LF / 2-space indent
- `.husky/pre-commit` — runs `lint-staged`

## TypeScript 6 + 7 side-by-side

`typescript-eslint` needs the TypeScript **6** programmatic API. The project keeps:

| Package                                  | Role                                  |
| ---------------------------------------- | ------------------------------------- |
| `typescript` → `@typescript/typescript6` | ESLint / tools importing `typescript` |
| `@typescript/native` → `typescript@7`    | `tsc` / typecheck (native 7.0)        |

Remove the dual install once typescript-eslint supports TS 7.1+.

## Notes

- `scripts/` is ignored by ESLint (ops scripts).
- React Compiler hooks rules (`set-state-in-effect`, `refs`, …) are enforced as **errors**.
- Pre-commit formats/lints staged files only. Always run `npm run verify` before merging.
