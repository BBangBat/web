import { describe, expect, it } from "vitest";
import {
  averageRating,
  compactReviewDate,
  compactAddress,
  distanceInKm,
  hasStoreImage,
  isSafeInternalPath,
  isWithinDaejeon,
} from "./format";

describe("format helpers", () => {
  it("calculates a zero distance for the same point", () => {
    expect(
      distanceInKm(
        { latitude: 36.3504, longitude: 127.3845 },
        { latitude: 36.3504, longitude: 127.3845 },
      ),
    ).toBe(0);
  });

  it("removes building details from an address", () => {
    expect(compactAddress("대전광역시 서구 둔산로 1 (1층 둔산동)")).toBe(
      "대전광역시 서구 둔산로 1",
    );
  });

  it("calculates an average rating", () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 3 }])).toBe(4);
    expect(averageRating([])).toBeNull();
  });

  it("formats review dates without relative time", () => {
    const now = new Date(2026, 7, 9);
    expect(compactReviewDate("2026-08-09T12:00:00", now)).toBe("08.09");
    expect(compactReviewDate("2025-08-08T12:00:00", now)).toBe("25.08.08");
    expect(compactReviewDate(null, now)).toBe("-");
  });

  it("only accepts internal navigation paths", () => {
    expect(isSafeInternalPath("/stores/1")).toBe(true);
    expect(isSafeInternalPath("//malicious.example")).toBe(false);
    expect(isSafeInternalPath("https://malicious.example")).toBe(false);
  });

  it("accepts backend-provided store and default images", () => {
    expect(hasStoreImage("https://cdn.example.com/stores/132.jpg")).toBe(true);
    expect(hasStoreImage("https://cdn.example.com/stores/default.jpg")).toBe(true);
    expect(hasStoreImage(null)).toBe(false);
  });

  it("detects whether a coordinate is inside the Daejeon service area", () => {
    expect(isWithinDaejeon({ latitude: 36.3504, longitude: 127.3845 })).toBe(true);
    expect(isWithinDaejeon({ latitude: 37.5665, longitude: 126.978 })).toBe(false);
  });
});
