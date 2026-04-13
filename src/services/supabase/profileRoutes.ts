export function profileSetupUrl(nextDestination: string | null | undefined): string {
  const path = nextDestination?.trim() || "/home";
  return `/profile?next=${encodeURIComponent(path)}`;
}
