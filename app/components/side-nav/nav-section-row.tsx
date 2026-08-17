import { ChevronRightIcon } from "lucide-react";
import { useNavigate } from "react-router";

import type { SectionId, TopNavLink } from "~/components/side-nav/constants";
import { NavRowButton } from "~/components/side-nav/nav-row-button";
import { NavSectionChildRow } from "~/components/side-nav/nav-section-child-row";
import { useSidebar } from "~/components/ui/sidebar";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

export function NavSectionRow({
  link,
  section,
  sectionLinks,
  pathname,
  iconRail,
  sectionOpen,
  isExpanded,
  isSectionActive,
  onToggleSection,
}: {
  link: TopNavLink;
  section: SectionId;
  sectionLinks: SideNavLink[];
  pathname: string;
  iconRail: boolean;
  sectionOpen: boolean;
  isExpanded: boolean;
  isSectionActive: boolean;
  onToggleSection: (section: SectionId) => void;
}) {
  const navigate = useNavigate();
  const { setOpen } = useSidebar();

  function handleSectionClick() {
    if (iconRail) {
      setOpen(true);
      if (!isExpanded) {
        onToggleSection(section);
      }
      void navigate(link.to);
      return;
    }
    if (!sectionOpen) {
      onToggleSection(section);
      return;
    }
    void navigate(link.to);
  }

  return (
    <li>
      <NavRowButton
        icon={link.icon}
        label={link.label}
        iconRail={iconRail}
        isActive={isSectionActive}
        aria-expanded={sectionOpen}
        onClick={handleSectionClick}
        trailing={
          iconRail ? null : (
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-sidebar-foreground/70",
                sectionOpen && "rotate-90",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSection(section);
              }}
            />
          )
        }
      />

      {sectionOpen ? (
        <ul className="flex flex-col">
          {sectionLinks.map((child) => (
            <NavSectionChildRow
              key={child.id}
              child={child}
              pathname={pathname}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
