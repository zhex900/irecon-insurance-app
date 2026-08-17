import {
  BadgeDollarSignIcon,
  ContactIcon,
  FilePenLineIcon,
  FileStackIcon,
  FileTextIcon,
  type LucideIcon,
  MailIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";

import { CHILD_ICONS, TOP_LINKS } from "~/components/side-nav/constants";
import { pathMatches } from "~/components/side-nav/utils/path-matches";

/** Same icon as the matching top-level / settings / reports menu item. */
export function iconForRecentPath(path: string): LucideIcon {
  const byExactChild: Record<string, LucideIcon> = {
    "/reports/car-policies": CHILD_ICONS["report-car-policies"] ?? FileTextIcon,
    "/reports/car-renewals":
      CHILD_ICONS["report-car-renewals"] ?? RefreshCwIcon,
    "/settings/users": CHILD_ICONS["settings-users"] ?? UserCogIcon,
    "/settings/ar-brokers": CHILD_ICONS["settings-ar-brokers"] ?? UsersIcon,
    "/settings/account-managers":
      CHILD_ICONS["settings-account-managers"] ?? ContactIcon,
    "/settings/email-templates":
      CHILD_ICONS["settings-email-templates"] ?? MailIcon,
    "/settings/library-documents":
      CHILD_ICONS["settings-library-documents"] ?? FileStackIcon,
    "/settings/document-templates":
      CHILD_ICONS["settings-document-templates"] ?? FilePenLineIcon,
    "/settings/features":
      CHILD_ICONS["settings-features"] ?? SlidersHorizontalIcon,
    "/settings/audit-log": CHILD_ICONS["settings-audit-log"] ?? ScrollTextIcon,
    "/settings/prices": CHILD_ICONS["settings-prices"] ?? BadgeDollarSignIcon,
  };

  if (byExactChild[path]) return byExactChild[path];

  if (path.startsWith("/settings/email-templates/")) {
    return CHILD_ICONS["settings-email-templates"] ?? MailIcon;
  }
  if (path.startsWith("/settings/document-templates/")) {
    return CHILD_ICONS["settings-document-templates"] ?? FilePenLineIcon;
  }
  if (path.startsWith("/settings/prices/")) {
    return CHILD_ICONS["settings-prices"] ?? BadgeDollarSignIcon;
  }

  for (const link of TOP_LINKS) {
    if (pathMatches(path, link.to, link.to === "/dashboard")) {
      return link.icon;
    }
  }

  return FileTextIcon;
}
