const UPSTREAM =
  process.env.BACKEND_UPSTREAM || "https://flashlearnapi.dongkiemem.site";

export const config = {
  matcher: ["/api/:path*"],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const target = new URL(`${url.pathname}${url.search}`, UPSTREAM);

  const headers = new Headers(request.headers);
  headers.set("host", target.host);

  return fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
}
