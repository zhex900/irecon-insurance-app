import { FileTextIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { CHILD_ICONS } from "~/components/side-nav/constants";
import { NavRowButton } from "~/components/side-nav/nav-row-button";
import { pathMatches } from "~/components/side-nav/utils/path-matches";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

export function NavSectionChildRow({
  child,
  pathname,
}: {
  child: SideNavLink;
  pathname: string;
}) {
  const navigate = useNavigate();
  const ChildIcon = CHILD_ICONS[child.id] ?? FileTextIcon;
  const isActive = pathMatches(pathname, child.href);

  return (
    <li>
      <NavRowButton
        icon={ChildIcon}
        label={child.label}
        variant="submenu"
        isActive={isActive}
        onClick={() => {
          void navigate(child.href);
        }}
      />
    </li>
  );
}
