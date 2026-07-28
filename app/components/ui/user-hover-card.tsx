import type { ReactNode } from "react";
import { formatRoleLabel } from "~/lib/auth/roles";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { UserAvatar } from "~/components/ui/user-avatar";
import type { NoteAuthor } from "~/lib/services/users/service";

export function UserHoverCard({
  user,
  children,
}: {
  user: NoteAuthor;
  children: ReactNode;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={100}
        render={
          <span className="cursor-default font-medium text-foreground underline-offset-2 hover:underline" />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent align="start" side="top" className="w-72 p-3">
        <div className="flex items-start gap-3">
          <UserAvatar
            email={user.email}
            fullName={user.fullName}
            userId={user.userId}
            avatarR2Key={user.avatarR2Key}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate font-medium text-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRoleLabel(user.role)}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
