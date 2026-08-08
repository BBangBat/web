import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/shared/api/client";

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
});
