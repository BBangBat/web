import { describe, expect, it } from "vitest";
import { reviewSchema } from "./review-form-validation";

const completeReview = {
  rating: 5,
  menus: ["소금빵"],
  content: "상세한 후기를 열 자 이상 작성했어요.",
};

describe("reviewSchema", () => {
  it("별점, 구매 메뉴, 상세 후기가 모두 유효할 때만 통과한다", () => {
    expect(reviewSchema.safeParse(completeReview).success).toBe(true);
    expect(reviewSchema.safeParse({ ...completeReview, rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...completeReview, menus: [] }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...completeReview, content: "아홉자미만" }).success).toBe(false);
  });
});
