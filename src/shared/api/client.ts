import type { ApiErrorBody } from "@/entities/types";

type ApiRequestOptions = RequestInit & {
  accessToken?: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code;
  }
}

export async function apiRequest<T>(
  path: string,
  { accessToken, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Some infrastructure errors have no JSON body.
    }
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
