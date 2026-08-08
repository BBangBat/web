import { isSafeInternalPath } from "@/shared/lib/format";

const MAP_LOGIN_MODAL_KEY = "bbangbat.map-login-modal";

export function requestMapLoginModal(returnTo = "/") {
  sessionStorage.setItem(
    MAP_LOGIN_MODAL_KEY,
    isSafeInternalPath(returnTo) ? returnTo : "/",
  );
}

export function consumeMapLoginModalRequest(): string | null {
  const returnTo = sessionStorage.getItem(MAP_LOGIN_MODAL_KEY);
  sessionStorage.removeItem(MAP_LOGIN_MODAL_KEY);
  return isSafeInternalPath(returnTo) ? returnTo : null;
}
