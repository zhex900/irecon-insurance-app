export function pathMatches(
  pathname: string,
  href: string,
  end = false,
): boolean {
  if (end || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
