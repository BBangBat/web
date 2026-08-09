import { describe, expect, it } from "vitest";
import { moveReviewImage } from "@/shared/lib/review-images";

describe("review image order", () => {
  it("moves an image while preserving the other image order", () => {
    expect(moveReviewImage(["first", "second", "third"], 2, 1)).toEqual([
      "first",
      "third",
      "second",
    ]);
  });

  it("preserves the original order when the requested move is invalid", () => {
    expect(moveReviewImage(["first", "second"], 3, 0)).toEqual([
      "first",
      "second",
    ]);
  });
});
