import { describe, expect, it, vi } from "vitest";
import { getCongestionVoteCoordinates } from "@/shared/hooks/use-geolocation";
import { DEFAULT_LOCATION } from "@/shared/lib/format";

describe("congestion vote coordinates", () => {
  it("로컬과 개발 환경에서는 위치 권한 없이 가게 좌표를 사용한다", async () => {
    const coordinatesProvider = vi.fn();
    const storeCoordinates = { latitude: 36.35, longitude: 127.38 };

    await expect(
      getCongestionVoteCoordinates({
        developmentCoordinates: storeCoordinates,
        useDevelopmentLocation: true,
        coordinatesProvider,
      }),
    ).resolves.toEqual(storeCoordinates);
    expect(coordinatesProvider).not.toHaveBeenCalled();
  });

  it("운영 환경에서는 브라우저의 실제 좌표를 사용한다", async () => {
    const coordinates = { latitude: 37.5665, longitude: 126.978 };
    const coordinatesProvider = vi.fn().mockResolvedValue(coordinates);

    await expect(
      getCongestionVoteCoordinates({
        useDevelopmentLocation: false,
        coordinatesProvider,
      }),
    ).resolves.toEqual(coordinates);
    expect(coordinatesProvider).toHaveBeenCalledOnce();
  });

  it("개발 좌표를 주지 않으면 대전 기본 좌표를 사용한다", async () => {
    await expect(
      getCongestionVoteCoordinates({ useDevelopmentLocation: true }),
    ).resolves.toEqual(DEFAULT_LOCATION);
  });
});
