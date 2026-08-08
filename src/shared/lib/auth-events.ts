export const ACCESS_TOKEN_REFRESHED_EVENT = "bbangbat:access-token-refreshed";
export const AUTH_SESSION_EXPIRED_EVENT = "bbangbat:auth-session-expired";

export function emitAccessTokenRefreshed(accessToken: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_REFRESHED_EVENT, {
    detail: { accessToken },
  }));
}

export function emitAuthSessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}
