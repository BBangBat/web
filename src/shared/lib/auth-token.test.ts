import { describe, expect, it } from "vitest";
import { getAccessTokenExpiresAt, getMemberIdFromAccessToken } from "./auth-token";

function tokenWith(payload: Record<string, unknown>) {
  const encoded = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${encoded}.signature`;
}

describe("getMemberIdFromAccessToken", () => {
  it("keeps a large numeric subject as an exact string", () => {
    expect(getMemberIdFromAccessToken(tokenWith({ sub: "864328633975214566" }))).toBe("864328633975214566");
  });

  it("supports the backend memberId claim and rejects invalid tokens", () => {
    expect(getMemberIdFromAccessToken(tokenWith({ memberId: 42 }))).toBe("42");
    expect(getMemberIdFromAccessToken("invalid-token")).toBeNull();
  });
});

describe("getAccessTokenExpiresAt", () => {
  it("JWT exp를 밀리초 만료 시각으로 변환한다", () => {
    expect(getAccessTokenExpiresAt(tokenWith({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it("만료 정보가 없거나 토큰이 잘못되면 null을 반환한다", () => {
    expect(getAccessTokenExpiresAt(tokenWith({ sub: "7" }))).toBeNull();
    expect(getAccessTokenExpiresAt("invalid-token")).toBeNull();
  });
});
