import { Link } from "react-router";
import { ArrowLeftIcon } from "lucide-react";

/** Shared back control for Settings sub-pages — always above page content. */
export function SettingsBackLink() {
  return (
    <div className="relative z-10 mb-4">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to Settings
      </Link>
    </div>
  );
}
