/**
 * Map backend reminder web routes to Expo Router paths.
 * Returns null when the route cannot be mapped.
 */
export function mapReminderRoute(webRoute: string): string | null {
  const route = webRoute.replace(/\/+$/, "") || "/";

  const exact: Record<string, string> = {
    "/revise": "/revise",
    "/speaking-coach": "/speaking",
    "/writing-coach": "/writing",
    "/listening": "/listening",
    "/listening/numbers": "/listening/numbers",
    "/grammar": "/grammar",
    "/course": "/courses",
  };
  if (exact[route]) return exact[route];

  let m = route.match(/^\/deck\/([^/]+)\/learn$/);
  if (m) return `/library/${m[1]}/learn`;

  m = route.match(/^\/deck\/([^/]+)\/revise$/);
  if (m) return `/library/${m[1]}/revise`;

  m = route.match(/^\/speaking-coach\/([^/]+)$/);
  if (m && m[1] !== "history" && m[1] !== "course") return `/speaking/${m[1]}`;

  m = route.match(/^\/writing-coach\/([^/]+)$/);
  if (m && m[1] !== "history") return `/writing/${m[1]}`;

  m = route.match(/^\/grammar\/([^/]+)$/);
  if (m) return `/grammar/${m[1]}`;

  m = route.match(/^\/speaking-coach\/course\/([^/]+)\/([^/]+)$/);
  if (m) return `/courses/${m[1]}/${m[2]}`;

  m = route.match(/^\/course\/([^/]+)(?:\/([^/]+))?$/);
  if (m) return m[2] ? `/courses/${m[1]}/${m[2]}` : `/courses/${m[1]}`;

  m = route.match(/^\/listening\/exercise\/([^/]+)/);
  if (m) return `/listening/exercise/${m[1]}`;

  return null;
}
