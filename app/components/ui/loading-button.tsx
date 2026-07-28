import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  /** When true, shows a spinner and disables the button. */
  loading?: boolean;
  /** Optional label while loading; defaults to `children`. */
  loadingLabel?: React.ReactNode;
};

/**
 * Button + Spinner composition (shadcn has no built-in isLoading prop).
 */
export function LoadingButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <Spinner data-icon="inline-start" /> : null}
      {loading && loadingLabel != null ? loadingLabel : children}
    </Button>
  );
}
