import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { avatarPublicPath, gravatarUrl, userInitials } from "~/lib/avatar";
import { cn } from "~/lib/utils";

export function UserAvatar({
  email,
  fullName,
  userId,
  avatarR2Key,
  src: srcOverride,
  size = "default",
  className,
  fallbackClassName,
}: {
  email: string;
  fullName: string;
  /** When set with avatarR2Key, loads custom R2 avatar. */
  userId?: string;
  avatarR2Key?: string | null;
  /** Explicit image URL (e.g. local preview blob). */
  src?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  const custom =
    srcOverride ||
    (userId && avatarR2Key ? avatarPublicPath(userId, avatarR2Key) : undefined);
  const src =
    custom || gravatarUrl(email, size === "lg" ? 128 : size === "sm" ? 48 : 80);
  const initials = userInitials(fullName);

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback
        className={cn(
          "bg-primary text-primary-foreground",
          size === "sm" && "text-xs",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
