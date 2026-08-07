import { SendIcon } from "lucide-react";
import { EmailDocumentFrame } from "~/components/email/email-document-frame";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { LoadingButton } from "~/components/ui/loading-button";

type EmailTemplatePreviewDialogProps = {
  open: boolean;
  recipient: string;
  subject: string;
  html: string;
  sending: boolean;
  onOpenChange: (open: boolean) => void;
  onRecipientChange: (recipient: string) => void;
  onSend: () => void;
};

export function EmailTemplatePreviewDialog({
  open,
  recipient,
  subject,
  html,
  sending,
  onOpenChange,
  onRecipientChange,
  onSend,
}: EmailTemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1 border-b p-4">
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            <div className="flex items-center gap-3 px-3">
              <label
                htmlFor="preview-to"
                className="w-16 shrink-0 text-sm text-muted-foreground"
              >
                To
              </label>
              <Input
                id="preview-to"
                type="email"
                value={recipient}
                onChange={(event) => onRecipientChange(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="min-w-0 flex-1 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 text-sm text-muted-foreground">
                Subject
              </span>
              <p className="min-w-0 flex-1 truncate text-sm">
                {subject || "—"}
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-white">
            <EmailDocumentFrame
              title="Email Preview"
              html={html}
              className="h-[min(28rem,50vh)]"
            />
          </div>
        </div>
        <DialogFooter className="p-8 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Close
          </Button>
          <LoadingButton
            type="button"
            loading={sending}
            onClick={onSend}
          >
            <SendIcon data-icon="inline-start" />
            Send
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
