import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";

type SelectProps = React.ComponentProps<"select"> & {
  label?: string;
  error?: string;
};

export function Select({ className, label, error, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-2">
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <select
        id={selectId}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          error && "border-red-500",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
