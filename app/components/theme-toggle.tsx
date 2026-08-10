import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "~/components/ui/button";
import { useHydrated } from "~/hooks/use-hydrated";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

const themes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export function ThemeToggle({
  className,
  align = "end",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(className)}
        aria-label="Toggle theme"
        disabled
      >
        <SunIcon className="size-4 opacity-0" aria-hidden />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(className)}
            aria-label="Toggle theme"
          >
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <DropdownMenuContent align={align} className="min-w-36">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {themes.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeModePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const current = hydrated ? (theme ?? "system") : "system";

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-1",
        className,
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {themes.map(({ value, label, icon: Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
