import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";

/** Hide browser PDF viewer page thumbnails / nav panes when supported. */
function pdfSrcWithoutNavPanes(src: string) {
  const hashIndex = src.indexOf("#");
  if (hashIndex === -1) return `${src}#navpanes=0`;
  const base = src.slice(0, hashIndex);
  const hash = src.slice(hashIndex + 1);
  if (/(?:^|&)navpanes=/.test(hash)) return src;
  return `${base}#${hash ? `${hash}&` : ""}navpanes=0`;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  src,
  loading = false,
  error = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Blob or authenticated URL for the PDF iframe. */
  src: string | null;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {error ? (
          <div className="flex h-[min(70vh,720px)] items-center justify-center rounded-md border bg-muted px-4 text-center text-sm text-destructive">
            {error}
          </div>
        ) : loading || !src ? (
          <div className="flex h-[min(70vh,720px)] items-center justify-center rounded-md border bg-muted">
            <Spinner className="size-6" />
          </div>
        ) : (
          <iframe
            title={title}
            src={pdfSrcWithoutNavPanes(src)}
            className="h-[min(70vh,720px)] w-full rounded-md border bg-muted"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
