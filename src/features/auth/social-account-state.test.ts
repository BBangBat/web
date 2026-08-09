import { describe, expect, it } from "vitest";
import {
  applyCurrentSocialProvider,
  canUnlinkSocial,
  resolveCurrentSocialProvider,
} from "@/features/auth/social-account-state";

const socials = [
  { provider: "NAVER" as const, current: true },
  { provider: "KAKAO" as const, current: false },
];

describe("social account state", () => {
  it("새 소셜 연동 응답이 현재 표시를 잃어도 기존 로그인 제공자를 유지한다", () => {
    const linkResponse = socials.map((social) => ({ ...social, current: false }));

    expect(resolveCurrentSocialProvider(linkResponse, "NAVER")).toBe("NAVER");
    expect(applyCurrentSocialProvider(linkResponse, "NAVER")).toEqual(socials);
  });

  it("현재 로그인 제공자만 연동 해제를 허용하지 않는다", () => {
    expect(canUnlinkSocial("NAVER", "NAVER")).toBe(false);
    expect(canUnlinkSocial("KAKAO", "NAVER")).toBe(true);
  });
});
