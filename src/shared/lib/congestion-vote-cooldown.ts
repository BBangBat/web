export const CONGESTION_VOTE_COOLDOWN_MINUTES = 15;
export const CONGESTION_VOTE_COOLDOWN_MS = CONGESTION_VOTE_COOLDOWN_MINUTES * 60 * 1_000;

export function congestionVoteCooldownStorageKey(storeId: number) {
  return `bbangbat:congestion-vote-cooldown:${storeId}`;
}

export function createCongestionVoteCooldownExpiry(now = Date.now()) {
  return now + CONGESTION_VOTE_COOLDOWN_MS;
}

export function createCongestionVoteCooldownExpiryFromSeconds(
  retryAfterSeconds: number,
  now = Date.now(),
) {
  return now + Math.max(0, retryAfterSeconds) * 1_000;
}

export function remainingCongestionVoteCooldownMinutes(expiresAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((expiresAt - now) / 60_000));
}
