import { Fragment } from "react";
import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

export type AppBreadcrumbItem = {
  label: string;
  /** Omit (or leave undefined) for the current page. */
  to?: string;
  /**
   * Full document navigation. Use when SPA transitions stall (e.g. leaving
   * TipTap / React Email editor pages).
   */
  reloadDocument?: boolean;
};

export function AppBreadcrumb({ items }: { items: AppBreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${item.to ?? "current"}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isLast || !item.to ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      item.reloadDocument ? (
                        <a href={item.to} />
                      ) : (
                        <Link to={item.to} />
                      )
                    }
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
