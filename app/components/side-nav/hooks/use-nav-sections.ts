import type { SectionId } from "~/components/side-nav/constants";

/**
 * Expanded Reports/Settings follow the cookie / user toggle only.
 * Route changes must not expand or collapse sections — that remounts the
 * submenu and flickers the w-max sidebar when leaving a leaf for Clients/etc.
 */
export function useNavSections(
  navSectionsExpanded: SectionId[],
  onNavSectionsChange: (sections: SectionId[]) => void,
) {
  function toggleNavSection(section: SectionId) {
    const next = navSectionsExpanded.includes(section)
      ? navSectionsExpanded.filter((id) => id !== section)
      : [...navSectionsExpanded, section];
    onNavSectionsChange(next);
  }

  return { expandedSections: navSectionsExpanded, toggleNavSection };
}
