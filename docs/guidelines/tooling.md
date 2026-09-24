# Tooling (lint / format)

Local quality gate for Irecon Insurance (Phase 8). CI should re-run the same commands — hooks alone are not enough.

## Commands

| Command                 | What                                                   |
| ----------------------- | ------------------------------------------------------ |
| `pnpm run lint`         | ESLint flat config                                     |
| `pnpm run lint:fix`     | ESLint with `--fix`                                    |
| `pnpm run format`       | Prettier write (incl. Tailwind class sort)             |
| `pnpm run format:check` | Prettier check                                         |
| `pnpm run typecheck`    | React Router typegen + `tsc` (TypeScript **7** native) |
| `pnpm run test:unit`    | Vitest unit                                            |
| `pnpm run verify`       | lint + format:check + typecheck + test:unit            |

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
- Pre-commit formats/lints staged files only. Always run `pnpm run verify` before merging.
- Install deps with `pnpm install` (`pnpm-lock.yaml` is the lockfile; CI uses `pnpm install --frozen-lockfile`).
