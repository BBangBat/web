import { afterEach, describe, expect, it, vi } from "vitest";
import { bbangbatApi } from "@/shared/api/bbangbat-api";

const stores = [
  {
    id: 1,
    name: "첫 번째 빵집",
    address: "대전광역시 중구",
    phoneNumber: null,
    imageUrl: "/default.jpg",
    latitude: 36.32,
    longitude: 127.42,
  },
  {
    id: 2,
    name: "두 번째 빵집",
    address: "대전광역시 서구",
    phoneNumber: null,
    imageUrl: "/default.jpg",
    latitude: 36.35,
    longitude: 127.38,
  },
];

describe("bbangbatApi profile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("presigned URL을 발급받아 같은 Content-Type으로 프로필 이미지를 PUT한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        presignedUrl: "https://uploads.example.com/profile",
        objectKey: "members/profile-key",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["profile-image"], "profile.png", { type: "image/png" });

    await expect(bbangbatApi.uploadProfileImage(file, "access-token")).resolves.toBe("members/profile-key");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/members/me/profile-image/presigned-url");
    const presignRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(presignRequest.method).toBe("POST");
    expect(JSON.parse(String(presignRequest.body))).toEqual({ contentType: "image/png" });
    expect(new Headers(presignRequest.headers).get("Authorization")).toBe("Bearer access-token");

    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://uploads.example.com/profile");
    const uploadRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(uploadRequest.method).toBe("PUT");
    expect(new Headers(uploadRequest.headers).get("Content-Type")).toBe("image/png");
    expect(uploadRequest.body).toBe(file);
  });

  it("PATCH /me에는 URL이 아닌 profileImageKey를 전달한다", async () => {
    const member = {
      id: 7,
      email: "bread@example.com",
      name: "빵친구",
      nickname: "빵친구",
      profileImageUrl: "https://cdn.example.com/members/profile-key",
      gender: "FEMALE",
      ageGroup: "TWENTIES",
      lastLoginAt: null,
      createdAt: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(member), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      bbangbatApi.updateProfile({ profileImageKey: "members/profile-key" }, "access-token"),
    ).resolves.toEqual(member);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/members/me");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(String(request.body))).toEqual({ profileImageKey: "members/profile-key" });
  });
});

describe("bbangbatApi store collection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("즐겨찾기 가게를 bulk API로 한 번에 조회하고 요청 ID 순서를 유지한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(stores), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(bbangbatApi.getStoresBulk([2, 1])).resolves.toEqual([stores[1], stores[0]]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stores/bulk?storeIds=2%2C1");
  });

  it("bulk API가 아직 배포되지 않은 404에서는 기존 단건 조회로 폴백한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(stores[0]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(stores[1]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bbangbatApi.getStoresBulk([1, 2])).resolves.toEqual(stores);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/stores/bulk?storeIds=1%2C2",
      "/api/stores/1",
      "/api/stores/2",
    ]);
  });

  it("지도 영역 API가 아직 배포되지 않은 404에서는 기존 좌표 조회로 폴백한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(stores), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bbangbatApi.getStoresByBounds(
      { south: 36.3, north: 36.4, west: 127.3, east: 127.45 },
      { latitude: 36.35, longitude: 127.4 },
    )).resolves.toEqual(stores);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/stores/bounds?south=36.3&north=36.4&west=127.3&east=127.45",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/stores?lat=36.35&lng=127.4");
  });
});
