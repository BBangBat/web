const DEFAULT_DEVELOPMENT_API_URL = "https://dev-api.bbangbat.com";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export const env = {
  oauthBaseUrl: normalizeBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_DEVELOPMENT_API_URL,
  ),
  kakaoMapAppKey: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || "",
} as const;
