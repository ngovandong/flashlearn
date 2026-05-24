const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(upstream, pathSegments, rawUrl) {
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments || "";
  const queryIndex = rawUrl.indexOf("?");
  const search = queryIndex >= 0 ? rawUrl.slice(queryIndex) : "";
  const base = upstream.replace(/\/+$/, "");
  const suffix = path ? `/${path}` : "";
  return `${base}/api${suffix}${search}`;
}

function forwardHeaders(incomingHeaders, targetHost) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (value === undefined) {
      continue;
    }

    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else {
      headers.set(key, value);
    }
  }

  headers.set("host", targetHost);
  headers.set("x-forwarded-host", incomingHeaders.host || targetHost);

  return headers;
}

export default async function handler(req, res) {
  const upstream = process.env.BACKEND_UPSTREAM;

  if (!upstream) {
    res.status(500).json({
      error: "BACKEND_UPSTREAM is not configured",
    });
    return;
  }

  const targetUrl = buildTargetUrl(upstream, req.query.path, req.url || "");
  const target = new URL(targetUrl);

  const headers = forwardHeaders(req.headers, target.host);
  const init = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }

  try {
    const upstreamResponse = await fetch(targetUrl, init);

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(502).json({
      error: "Bad Gateway",
      message: error.message,
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
