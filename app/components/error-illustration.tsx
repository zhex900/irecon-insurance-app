/** Inline error-page illustration (404 / unexpected). */
export function ErrorPageIllustration({
  className,
  title = "Something went wrong",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect
        x="24"
        y="36"
        width="200"
        height="148"
        rx="16"
        className="fill-muted stroke-border"
        strokeWidth="2"
      />
      <path
        d="M48 72h120M48 96h88M48 120h104"
        className="stroke-muted-foreground/40"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle
        cx="236"
        cy="128"
        r="56"
        className="fill-background stroke-foreground/20"
        strokeWidth="3"
      />
      <path
        d="M214 128h44M236 106v44"
        className="stroke-foreground/70"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M196 168c18 18 48 18 66 0"
        className="stroke-destructive/80"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="210" cy="58" r="10" className="fill-primary/80" />
      <circle cx="268" cy="78" r="6" className="fill-muted-foreground/50" />
      <path
        d="M72 176c28-36 64-36 92 0"
        className="stroke-primary/30"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
