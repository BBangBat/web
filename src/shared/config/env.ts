const DEFAULT_DEVELOPMENT_API_URL = "https://dev-api.bbangbat.com";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

const apiBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_DEVELOPMENT_API_URL,
);

export const env = {
  oauthBaseUrl: apiBaseUrl,
  kakaoMapAppKey: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || "",
} as const;
