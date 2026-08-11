import { describe, expect, it } from "vitest";
import { resolveSearchAreaPixels } from "./map-search-area";

describe("resolveSearchAreaPixels", () => {
  it("명시적 검색에서는 검색 버튼 위와 지도 조작 버튼 왼쪽까지만 포함한다", () => {
    expect(resolveSearchAreaPixels({
      width: 1000,
      height: 700,
      mobileBottomInset: 0,
      isMobile: false,
      restrictToControls: true,
      controlsRight: 979,
      searchButtonBottom: 675,
    })).toEqual({ right: 1000, bottom: 700 });
  });

  it("모바일에서는 바텀시트 경계보다 검색 버튼 경계가 높으면 더 작은 범위를 사용한다", () => {
    expect(resolveSearchAreaPixels({
      width: 390,
      height: 800,
      mobileBottomInset: 270,
      isMobile: true,
      restrictToControls: true,
      controlsRight: 383,
      searchButtonBottom: 515,
    })).toEqual({ right: 383, bottom: 515 });
  });

  it("자동 뷰포트 갱신은 기존 모바일 가시 영역을 유지한다", () => {
    expect(resolveSearchAreaPixels({
      width: 390,
      height: 800,
      mobileBottomInset: 270,
      isMobile: true,
      restrictToControls: false,
    })).toEqual({ right: 390, bottom: 530 });
  });
});
