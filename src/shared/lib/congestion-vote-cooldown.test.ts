import { describe, expect, it } from "vitest";
import {
  CONGESTION_VOTE_COOLDOWN_MS,
  createCongestionVoteCooldownExpiry,
  createCongestionVoteCooldownExpiryFromSeconds,
  remainingCongestionVoteCooldownMinutes,
} from "@/shared/lib/congestion-vote-cooldown";

describe("congestion vote cooldown", () => {
  it("투표 성공 시점부터 15분 만료 시각을 계산한다", () => {
    expect(createCongestionVoteCooldownExpiry(1_000)).toBe(1_000 + CONGESTION_VOTE_COOLDOWN_MS);
  });

  it("남은 시간을 분 단위로 올림하고 만료 후에는 0을 반환한다", () => {
    const expiresAt = createCongestionVoteCooldownExpiry(0);

    expect(remainingCongestionVoteCooldownMinutes(expiresAt, 0)).toBe(15);
    expect(remainingCongestionVoteCooldownMinutes(expiresAt, 60_001)).toBe(14);
    expect(remainingCongestionVoteCooldownMinutes(expiresAt, expiresAt - 1)).toBe(1);
    expect(remainingCongestionVoteCooldownMinutes(expiresAt, expiresAt)).toBe(0);
  });

  it("서버가 내려준 초 단위 재시도 시간을 만료 시각으로 변환한다", () => {
    expect(createCongestionVoteCooldownExpiryFromSeconds(612, 1_000)).toBe(613_000);
  });
});
