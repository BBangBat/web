const MEMBER_ID_CLAIMS = ["memberId", "sub", "id", "userId"] as const;

export function getMemberIdFromAccessToken(accessToken: string): string | null {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) return null;

    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

    for (const claim of MEMBER_ID_CLAIMS) {
      const value = payload[claim];
      if (value === null || value === undefined) continue;
      const memberId = String(value);
      if (/^\d+$/.test(memberId)) return memberId;
    }
  } catch {
    return null;
  }

  return null;
}
