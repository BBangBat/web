import { describe, expect, it } from "vitest";
import { shouldPreserveSelectedCardOnDetailClose } from "@/features/home/home-navigation";

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
});
