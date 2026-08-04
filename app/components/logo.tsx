import { cn } from "~/lib/utils";

type LogoProps = {
  className?: string;
  /** When false, only the mark is shown (keeps side-nav width tied to nav labels). */
  showTagline?: boolean;
};

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex w-max flex-col items-start gap-0.5",
        className,
      )}
    >
      <img
        src="/irecon-logo.svg"
        alt="IRECON"
        decoding="async"
        className={cn(
          "aspect-214/52 w-auto max-w-full object-contain object-left",
          "h-8",
        )}
      />

      <span className="text-[10px] leading-none font-medium tracking-wide whitespace-nowrap text-primary">
        Insurance Services Pty Ltd
      </span>
    </span>
  );
}
