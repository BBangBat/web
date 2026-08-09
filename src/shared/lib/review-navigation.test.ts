import { describe, expect, it } from "vitest";
import { reviewMapHref } from "./review-navigation";

describe("reviewMapHref", () => {
  it("가게 상세의 특정 빵명록으로 이동할 검색 조건을 만든다", () => {
    expect(reviewMapHref(12, 34)).toBe(
      "/?storeId=12&detail=sidebar&reviewId=34",
    );
  });
});
