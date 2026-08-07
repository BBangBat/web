import { describe, expect, it } from "vitest";
import { getMemberIdFromAccessToken } from "./auth-token";

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
