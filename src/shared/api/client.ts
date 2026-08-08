import type { ApiErrorBody } from "@/entities/types";
import {
  emitAccessTokenRefreshed,
  emitAuthSessionExpired,
} from "@/shared/lib/auth-events";

type ApiRequestOptions = RequestInit & {
  accessToken?: string | null;
  retryUnauthorized?: boolean;
};

let refreshRequest: Promise<string> | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, body: ApiErrorBody | null, retryAfterSeconds?: number) {
    super(body?.message || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code;
    this.retryAfterSeconds = body?.retryAfterSeconds ?? retryAfterSeconds;
  }
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
}

function isAuthenticationFailure(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;

  const request = apiRequest<{ accessToken: string }>("/auth/token/refresh", {
    method: "POST",
    retryUnauthorized: false,
  }).then(({ accessToken }) => {
    if (!accessToken) throw new Error("갱신된 로그인 정보를 확인하지 못했어요.");
    return accessToken;
  });

  refreshRequest = request;
  void request.finally(() => {
    if (refreshRequest === request) refreshRequest = null;
  }).catch(() => {
    // The caller receives and handles the original rejection.
  });
  return request;
}

export async function apiRequest<T>(
  path: string,
  { accessToken, retryUnauthorized = true, ...init }: ApiRequestOptions = {},
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

  if (response.status === 401 && accessToken && retryUnauthorized) {
    try {
      const refreshedAccessToken = await refreshAccessToken();
      emitAccessTokenRefreshed(refreshedAccessToken);
      try {
        return await apiRequest<T>(path, {
          ...init,
          accessToken: refreshedAccessToken,
          retryUnauthorized: false,
        });
      } catch (retryError) {
        if (isAuthenticationFailure(retryError)) emitAuthSessionExpired();
        throw retryError;
      }
    } catch (refreshError) {
      if (isAuthenticationFailure(refreshError)) emitAuthSessionExpired();
      throw refreshError;
    }
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Some infrastructure errors have no JSON body.
    }
    throw new ApiError(
      response.status,
      body,
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) return undefined as T;
  return JSON.parse(responseText) as T;
}
