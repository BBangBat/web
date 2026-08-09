import type { SocialProvider } from "@/entities/types";

const SOCIAL_UNLINK_REQUEST_KEY = "bbangbat:social-unlink-request";

export const SOCIAL_UNLINK_RETURN_TO = "/mypage?tab=profile";
export const WITHDRAWAL_REAUTH_RETURN_TO = "/mypage?tab=profile&withdraw=reauthenticated";

export type SocialUnlinkRequest = {
  action: "unlink-social" | "withdraw-member";
  memberId: string;
  provider: SocialProvider;
};

function isSocialProvider(value: unknown): value is SocialProvider {
  return value === "NAVER" || value === "KAKAO";
}

export function storeSocialUnlinkRequest(request: SocialUnlinkRequest) {
  sessionStorage.setItem(SOCIAL_UNLINK_REQUEST_KEY, JSON.stringify(request));
}

export function readSocialUnlinkRequest(): SocialUnlinkRequest | null {
  try {
    const raw = sessionStorage.getItem(SOCIAL_UNLINK_REQUEST_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SocialUnlinkRequest>;
    if (
      (value.action !== "unlink-social" && value.action !== "withdraw-member")
      || typeof value.memberId !== "string"
      || !isSocialProvider(value.provider)
    ) return null;
    return value as SocialUnlinkRequest;
  } catch {
    return null;
  }
}

export function clearSocialUnlinkRequest() {
  sessionStorage.removeItem(SOCIAL_UNLINK_REQUEST_KEY);
}
