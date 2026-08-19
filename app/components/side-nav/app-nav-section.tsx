import { type SectionId, TOP_LINKS } from "~/components/side-nav/constants";
import { NavLinkRow } from "~/components/side-nav/nav-link-row";
import { NavSectionRow } from "~/components/side-nav/nav-section-row";
import type { SideNavData } from "~/lib/services/navigation/side-nav.service";
import { sectionFromPathname } from "~/lib/services/navigation/sidebar-state";

export function AppNavSection({
  data,
  pathname,
  iconRail,
  expandedSections,
  onToggleSection,
}: {
  data: SideNavData;
  pathname: string;
  iconRail: boolean;
  expandedSections: SectionId[];
  onToggleSection: (section: SectionId) => void;
}) {
  return (
    <div className="[--side-nav-indent:16px]">
      <ul className="flex w-max flex-col">
        {TOP_LINKS.map((link) => {
          if (!link.section) {
            return (
              <NavLinkRow
                key={link.id}
                link={link}
                pathname={pathname}
                iconRail={iconRail}
              />
            );
          }

          const section = link.section;
          const sectionLinks =
            section === "reports" ? data.reports : data.settings;
          if (sectionLinks.length === 0) return null;

          const sectionOpen = expandedSections.includes(section) && !iconRail;
          const isSectionActive = sectionFromPathname(pathname) === section;

          return (
            <NavSectionRow
              key={link.id}
              link={link}
              section={section}
              sectionLinks={sectionLinks}
              pathname={pathname}
              iconRail={iconRail}
              sectionOpen={sectionOpen}
              isExpanded={expandedSections.includes(section)}
              isSectionActive={isSectionActive}
              onToggleSection={onToggleSection}
            />
          );
        })}
      </ul>
    </div>
  );
}
