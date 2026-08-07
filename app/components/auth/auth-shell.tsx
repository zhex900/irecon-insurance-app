import type { ReactNode } from "react";
import { Logo } from "~/components/logo";
import { OfflineDialog } from "~/components/layout/offline-dialog";
import { ThemeToggle } from "~/components/theme-toggle";

function AuthBlueprintBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.22]"
      aria-hidden
    >
      <svg
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
      >
        <g
          fill="none"
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          transform="translate(280 420) scale(1.4)"
        >
          <path d="M40 120 L160 60 L280 120 L160 180 Z" />
          <path d="M40 120 L40 200 L160 260 L160 180" />
          <path d="M280 120 L280 200 L160 260" />
          <path d="M100 90 L100 150 L220 90 L220 30 Z" opacity="0.7" />
          <g transform="translate(240 -40)">
            <path d="M20 220 L20 40" />
            <path d="M20 40 L120 70" />
            <path d="M20 70 L90 90" />
            <path d="M70 55 L70 120" strokeDasharray="3 3" />
            <path d="M12 220 L28 220 L24 232 L16 232 Z" fill="white" />
          </g>
          <g opacity="0.65" transform="translate(-20 40)">
            <path d="M0 160 H80 V220 H0 Z" />
            <path d="M0 190 H80" />
            <path d="M40 160 V220" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen">
      <OfflineDialog />
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <section className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-black p-10 text-invert-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 20% 20%, oklch(0.55 0.2 262 / 0.45), transparent 50%), radial-gradient(ellipse at 80% 80%, oklch(0.7 0.12 180 / 0.35), transparent 45%)",
          }}
        />
        <AuthBlueprintBackground />
        <div className="relative z-10">
          <Logo className="[&>span]:text-invert-foreground" />
          <h1 className="mt-16 max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Manage Clients & Policies with Confidence.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-invert-foreground/70">
            The broker workspace for CAR insurance — quote, bind, adjust, and
            renew in one place.
          </p>
          <ul className="mt-10 flex flex-col gap-4 text-sm text-invert-foreground/80">
            {[
              "Review portfolio activity",
              "Create & manage clients",
              "Adjust policies instantly",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/30 text-xs">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center border-l border-border bg-background p-6 dark:bg-card">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            <a
              href="https://www.irecon.com.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              © Copyright Irecon Insurance Services Pty Ltd{" "}
              {new Date().getFullYear()}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
