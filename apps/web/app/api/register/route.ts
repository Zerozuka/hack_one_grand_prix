const apiBaseUrl = process.env.API_BASE_URL ?? "http://api:8000";

export async function POST(request: Request) {
  const body = await request.text();

  const res = await fetch(`${apiBaseUrl}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
