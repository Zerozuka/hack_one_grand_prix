import { getAuthSession } from "@/lib/auth";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://api:8000";

async function proxy(request: Request, path: string[]) {
  const session = await getAuthSession();
  if (!session?.internalToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const target = new URL(`${apiBaseUrl}/${path.join("/")}`);
  const incomingUrl = new URL(request.url);
  target.search = incomingUrl.search;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const response = await fetch(target, {
    method: request.method,
    body,
    headers: {
      Authorization: `Bearer ${session.internalToken}`,
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
    },
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
