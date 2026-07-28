import { cn } from "~/lib/utils";

const sizeClass = {
  sm: "h-7",
  md: "h-8",
  lg: "h-10",
} as const;

const textSizeClass = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-xs",
} as const;

type LogoProps = {
  className?: string;
  size?: keyof typeof sizeClass;
  /**
   * - `adaptive` — invert in dark mode (default page backgrounds)
   * - `invert` — always white (dark panels / black sidebars)
   * - `default` — original asset colors
   */
  tone?: "adaptive" | "invert" | "default";
};

export function Logo({ className, size = "sm", tone = "adaptive" }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 flex-col items-start gap-0.5",
        className,
      )}
    >
      <img
        src="/irecon-icon.png"
        alt="IRECON"
        width={236}
        height={63}
        decoding="async"
        className={cn(
          "aspect-236/63 w-auto max-w-full object-contain object-left",
          sizeClass[size],
          tone === "invert" && "brightness-0 invert",
          tone === "adaptive" && "dark:brightness-0 dark:invert",
        )}
      />
      <span
        className={cn(
          "max-w-full leading-none font-medium tracking-wide whitespace-nowrap text-primary",
          textSizeClass[size],
        )}
      >
        Insurance Services Pty Ltd
      </span>
    </span>
  );
}
