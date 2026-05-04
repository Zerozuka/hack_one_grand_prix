import { getAuthSession } from "./auth";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://api:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function getSessionToken() {
  const session = await getAuthSession();
  if (!session?.internalToken) {
    throw new ApiError("Unauthorized", 401);
  }
  return session.internalToken;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getSessionToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(await response.text(), response.status);
  }

  return (await response.json()) as T;
}
