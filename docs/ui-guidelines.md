# UI guidelines

shadcn/ui, ReUI, Tailwind, accessibility, and design-system rules for BrokerSure.

Also follow the local skills: `.cursor/skills/shadcn/` and `.cursor/skills/reui/` (and the ReUI MCP). This doc is the project contract; skills carry detailed Incorrect/Correct examples.

## Design system

| Piece           | Location / choice                                                  |
| --------------- | ------------------------------------------------------------------ |
| Primitives      | `app/components/ui/` — shadcn **`base-nova`** (Base UI, not Radix) |
| Building blocks | `app/components/reui/` — data-grid, filters, stepper, badge, …     |
| Theme           | `app/app.css` — CSS variables (“IRECON Night Ops”)                 |
| Icons           | `lucide-react`                                                     |
| Toasts          | `sonner`                                                           |
| Font            | Geist Variable (`--font-sans`)                                     |
| Brand           | Primary red tokens; dark sidebar even in light mode                |
| Radius          | `--radius: 0.625rem`                                               |

**Compose, don’t reinvent.** Settings = Tabs + Field forms + dialogs. Tables with sort/filter/virtualization = ReUI **data-grid**, not a hand-rolled `<table>`.

### Adding components

```bash
npx shadcn@latest add button input card table sidebar
npx shadcn@latest add @reui/stepper @reui/data-grid @reui/filters
```

Workflow for ReUI: **search (MCP) → install → read component API → adapt** (wire real data, keep tokens). Do not restyle ReUI into a parallel look.

This project uses **Base UI**. Prefer the `render` prop for custom triggers (not Radix `asChild`), per `components.json` / shadcn skill `base-vs-radix`.

## Tailwind & tokens

- Use **semantic colors only**: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `text-destructive`, sidebar tokens, ReUI extensions (`success`, `warning`, `info`, …).
- Never hardcode brand/status colors (`bg-blue-500`, `text-emerald-600`) in product UI.
- Prefer built-in **variants** (`variant="outline"`, `size="sm"`) over overriding component chrome with `className`.
- `className` is for **layout and spacing**, not recoloring primitives.
- Use `flex` + `gap-*` (and `flex-col gap-*`). **Do not** use `space-x-*` / `space-y-*`.
- Equal width/height → `size-*`, not `w-* h-*`.
- Use `truncate` instead of the long overflow/ellipsis trio.
- Conditionals → `cn()` from `~/lib/utils`. No nested ternary class strings.
- No manual `dark:` color hacks — rely on CSS variables / `next-themes` class strategy.
- No manual `z-index` on Dialog / Sheet / Popover / Dropdown — they manage stacking.

## Forms

Always use **`FieldGroup` + `Field`** (and `FieldLabel` / `FieldError` / `FieldDescription`). Do not lay out forms with bare `div` + `gap` as a substitute for Field.

```tsx
<FieldGroup>
  <Field data-invalid={Boolean(errors.email)}>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" aria-invalid={Boolean(errors.email)} />
    <FieldError>{errors.email}</FieldError>
  </Field>
</FieldGroup>
```

Rules:

- Validation: `data-invalid` on `Field`, `aria-invalid` on the control. Disabled: `data-disabled` on `Field`, `disabled` on the control.
- Prefer shared helpers in `app/components/ui/form-controls.tsx` (`FieldInput`, etc.) with RHF.
- `InputGroup` must use `InputGroupInput` / `InputGroupTextarea` — never raw `Input` inside.
- Buttons inside inputs → `InputGroup` + `InputGroupAddon`.
- Related checkboxes/radios → `FieldSet` + `FieldLegend`.
- Option sets of ~2–7 choices → `ToggleGroup`, not a row of manual `Button`s.
- Draft vs submit: soft Zod for autosave, full schema on final save; surface errors and focus where the wizard already does.
- Success feedback: `toast` / `use-success-toast` after CRUD — match existing copy tone.

Control chooser:

| Need                  | Use                           |
| --------------------- | ----------------------------- |
| Text                  | `Input`                       |
| Fixed options         | `Select`                      |
| Searchable            | `Combobox`                    |
| Boolean (settings)    | `Switch`                      |
| Boolean (forms)       | `Checkbox`                    |
| Few exclusive options | `RadioGroup` or `ToggleGroup` |
| Multiline             | `Textarea`                    |

## Composition

- Items live inside their Group (`SelectGroup`, `DropdownMenuGroup`, `CommandGroup`).
- Dialog / Sheet / Drawer always include a Title (`DialogTitle`, …). Use `sr-only` if visually hidden.
- Full Card structure when Cards are used: Header / Title / Description / Content / Footer.
- `TabsTrigger` only inside `TabsList`.
- `Avatar` always includes `AvatarFallback`.
- Loading buttons: compose `Spinner` + `disabled` + `data-icon` — Button has no `isPending` prop.
- Empty states → `Empty` (or existing empty patterns). Callouts → `Alert`. Dividers → `Separator`. Placeholders → `Skeleton`.
- Status chips → `Badge` (or ReUI badge), not custom colored spans.

## Icons

- Lucide icons as components: `icon={CheckIcon}`, not string keys.
- Inside `Button`, mark icons with `data-icon="inline-start"` or `"inline-end"`.
- Do not put `size-4` / `w-4 h-4` on icons inside components that size icons via CSS.

## Layout & UX patterns

- Match existing **page header**, list + pagination, dialog, and toast patterns before inventing new chrome.
- Prefer one job per view section; avoid dashboard clutter on transactional screens.
- Lists: reuse pagination / query-param patterns from existing list routes.
- Dense admin tables: ReUI data-grid + filters.
- Multi-step policy flow: ReUI stepper + existing wizard structure — split sections into files rather than growing mega-files.
- Responsive: list and wizard must work on narrow widths; pagination already wraps — verify when touching those surfaces.
- Feature-flag unfinished UI; do not ship prototype-only routes without a gate.

## Accessibility

Every input / control needs:

| Requirement   | How                                                |
| ------------- | -------------------------------------------------- |
| Label         | Visible `FieldLabel`, or `sr-only` / `aria-label`  |
| Description   | `FieldDescription` when helpful                    |
| Error         | `FieldError` + `data-invalid` / `aria-invalid`     |
| Keyboard      | Native control or `Button` — no click-only `div`s  |
| Focus visible | Do not remove focus rings                          |
| ARIA          | Only when the primitive doesn’t already provide it |

Also:

- Dialog / Sheet / Drawer always have a Title (`sr-only` if needed).
- On validation failure, focus the first invalid field (wizard already does — don’t regress).
- **Color is never the only indicator** — pair with text or Badge.
- Respect `prefers-reduced-motion` for new motion.

## Copy & locale

- User-facing product name: **BrokerSure**.
- Dates/currency: Australian conventions (`en-AU`, AUD helpers in `~/lib/utils`).
- Avoid prototype leftover titles (“CAR Broker Portal”) in new UI strings.

## Anti-patterns

- Second component library or custom CSS framework.
- Cards-for-everything / nested card soup on forms.
- Raw Tailwind palette for brand or status.
- Hand-rolled data tables when ReUI data-grid fits.
- Overriding shadcn/ReUI internals instead of variants + tokens.
- Giant single-file wizards — extract section components and hooks.
