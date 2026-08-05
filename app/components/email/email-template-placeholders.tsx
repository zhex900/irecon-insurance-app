import { Badge } from "~/components/reui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "~/lib/email/templates";

type EmailTemplatePlaceholdersProps = {
  editable: boolean;
  target: "subject" | "body";
  onInsert: (token: string, key: string) => void;
};

export function EmailTemplatePlaceholders({
  editable,
  target,
  onInsert,
}: EmailTemplatePlaceholdersProps) {
  return (
    <Card
      size="sm"
      className="flex h-[min(36rem,65vh)] flex-col overflow-hidden lg:sticky lg:top-20"
    >
      <CardHeader className="shrink-0 gap-1">
        <CardTitle>Placeholders</CardTitle>
        <CardDescription>
          Click a tag to insert at the cursor in the{" "}
          {target === "subject" ? "subject" : "message"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {EMAIL_TEMPLATE_PLACEHOLDERS.map(({ key, token }) => (
            <Badge
              key={key}
              variant="warning-light"
              size="sm"
              radius="full"
              render={
                <button
                  type="button"
                  disabled={!editable}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onInsert(token, key)}
                  title={
                    key === "footerImage"
                      ? "Insert footer image (database blob)"
                      : `Insert ${token}`
                  }
                />
              }
              className={
                editable
                  ? "w-fit cursor-pointer font-mono hover:bg-warning/20"
                  : "w-fit cursor-default font-mono opacity-60"
              }
            >
              {token}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
