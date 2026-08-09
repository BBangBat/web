import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/shared/api/client";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/shared/lib/auth-events";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("브라우저와 같은 출처의 API 프록시를 사용한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ ok: boolean }>("/api/health");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("본문이 없는 201 성공 응답을 오류로 처리하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));

    await expect(apiRequest<void>("/api/members/favorites/1", { method: "POST" }))
      .resolves.toBeUndefined();
  });

  it("429 응답의 retryAfterSeconds를 API 오류에 보존한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "CONGESTION_VOTE_COOLDOWN",
        message: "잠시 후 다시 투표할 수 있습니다.",
        retryAfterSeconds: 612,
      }), {
        status: 429,
        headers: { "Retry-After": "600" },
      }),
    ));

    const request = apiRequest<void>("/api/congestion", { method: "POST" });

    await expect(request).rejects.toMatchObject({
      status: 429,
      code: "CONGESTION_VOTE_COOLDOWN",
      retryAfterSeconds: 612,
    });
  });

  it("응답 본문에 재시도 시간이 없으면 Retry-After 헤더를 사용한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "CONGESTION_VOTE_COOLDOWN" }), {
        status: 429,
        headers: { "Retry-After": "90" },
      }),
    ));

    await expect(apiRequest<void>("/api/congestion", { method: "POST" }))
      .rejects.toMatchObject({ retryAfterSeconds: 90 });
  });

  it("인증 요청이 401이면 액세스 토큰을 한 번 갱신하고 원래 요청을 재시도한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ favorite: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ favorite: boolean }>("/api/members/favorites/7", {
      method: "POST",
      accessToken: "expired-access-token",
    })).resolves.toEqual({ favorite: true });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/members/favorites/7",
      "/auth/token/refresh",
      "/api/members/favorites/7",
    ]);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).credentials).toBe("include");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization"))
      .toBe("Bearer expired-access-token");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization"))
      .toBe("Bearer new-access-token");
  });

  it("리프레시 쿠키가 없어 토큰 갱신이 401이면 재로그인을 위해 세션 만료를 알린다", async () => {
    const sessionExpired = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, sessionExpired);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: "로그인이 필요합니다.",
      }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(apiRequest<void>("/api/members/favorites/7", {
        method: "POST",
        accessToken: "expired-access-token",
      })).rejects.toMatchObject({ status: 401 });
      expect(sessionExpired).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        "/api/members/favorites/7",
        "/auth/token/refresh",
      ]);
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, sessionExpired);
    }
  });

  it("토큰 갱신 후 업무 권한 403이 발생해도 로그인 세션을 만료시키지 않는다", async () => {
    const sessionExpired = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, sessionExpired);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "CONGESTION_VOTE_TOO_FAR",
        message: "가게 근처에서만 투표할 수 있습니다.",
      }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(apiRequest<void>("/api/congestion", {
        method: "POST",
        accessToken: "expired-access-token",
      })).rejects.toMatchObject({ status: 403, code: "CONGESTION_VOTE_TOO_FAR" });
      expect(sessionExpired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, sessionExpired);
    }
  });
});
