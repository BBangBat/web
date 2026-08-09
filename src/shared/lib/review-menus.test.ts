import { describe, expect, it } from "vitest";
import { mergeReviewMenus } from "@/shared/lib/review-menus";

describe("review menus", () => {
  it("trims, removes empty values, and keeps menu names unique", () => {
    expect(mergeReviewMenus(["소금빵"], [" 크루아상 ", "", "소금빵"])).toEqual([
      "소금빵",
      "크루아상",
    ]);
  });
});
