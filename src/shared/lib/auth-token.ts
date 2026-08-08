const MEMBER_ID_CLAIMS = ["memberId", "sub", "id", "userId"] as const;

function decodeAccessTokenPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) return null;

    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getMemberIdFromAccessToken(accessToken: string): string | null {
  const payload = decodeAccessTokenPayload(accessToken);
  if (!payload) return null;

  try {
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

export function getAccessTokenExpiresAt(accessToken: string): number | null {
  const payload = decodeAccessTokenPayload(accessToken);
  const expiresAtSeconds = payload?.exp;
  return typeof expiresAtSeconds === "number" && Number.isFinite(expiresAtSeconds)
    ? expiresAtSeconds * 1_000
    : null;
}
