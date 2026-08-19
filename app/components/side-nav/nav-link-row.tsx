import { useNavigate } from "react-router";

import type { TopNavLink } from "~/components/side-nav/constants";
import { NavRowButton } from "~/components/side-nav/nav-row-button";
import { pathMatches } from "~/components/side-nav/utils/path-matches";

export function NavLinkRow({
  link,
  pathname,
  iconRail,
}: {
  link: TopNavLink;
  pathname: string;
  iconRail: boolean;
}) {
  const navigate = useNavigate();
  const isActive = pathMatches(pathname, link.to, link.to === "/dashboard");

  return (
    <li>
      <NavRowButton
        icon={link.icon}
        label={link.label}
        iconRail={iconRail}
        isActive={isActive}
        onClick={() => {
          void navigate(link.to);
        }}
      />
    </li>
  );
}
