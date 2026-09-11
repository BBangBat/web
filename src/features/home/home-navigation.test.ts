import { describe, expect, it } from "vitest";
import {
  getMobileDetailHistoryStoreId,
  shouldPreserveSelectedCardOnDetailClose,
} from "@/features/home/home-navigation";

describe("shouldPreserveSelectedCardOnDetailClose", () => {
  it("모바일에서 외부 화면으로부터 연 가게를 닫으면 선택 카드를 유지한다", () => {
    expect(shouldPreserveSelectedCardOnDetailClose({
      isMobile: true,
      preserveSelectedCard: true,
      selectedStoreId: 132,
      initialStoreId: 132,
    })).toBe(true);
  });

  it("검색이나 지도에서 선택한 가게와 데스크톱 상세는 유지하지 않는다", () => {
    expect(shouldPreserveSelectedCardOnDetailClose({
      isMobile: true,
      preserveSelectedCard: false,
      selectedStoreId: 132,
      initialStoreId: 132,
    })).toBe(false);
    expect(shouldPreserveSelectedCardOnDetailClose({
      isMobile: false,
      preserveSelectedCard: true,
      selectedStoreId: 132,
      initialStoreId: 132,
    })).toBe(false);
  });

  it("모바일 시스템 뒤로가기는 외부 화면에서 연 상세라도 목록으로 돌아간다", () => {
    expect(shouldPreserveSelectedCardOnDetailClose({
      isMobile: true,
      preserveSelectedCard: true,
      selectedStoreId: 132,
      initialStoreId: 132,
      fromBrowserHistory: true,
    })).toBe(false);
  });
});

describe("getMobileDetailHistoryStoreId", () => {
  it("모바일 상세 히스토리 항목에서만 유효한 가게 ID를 읽는다", () => {
    expect(getMobileDetailHistoryStoreId(
      { bbangbatMobileDetail: true },
      "https://bbangbat.com/?storeId=132",
    )).toBe(132);
  });

  it("목록 항목과 잘못된 가게 ID는 상세 복귀로 처리하지 않는다", () => {
    expect(getMobileDetailHistoryStoreId({}, "https://bbangbat.com/?storeId=132")).toBeNull();
    expect(getMobileDetailHistoryStoreId(
      { bbangbatMobileDetail: true },
      "https://bbangbat.com/?storeId=invalid",
    )).toBeNull();
  });
});
