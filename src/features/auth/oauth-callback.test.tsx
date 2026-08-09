import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthCallback } from "@/features/auth/oauth-callback";

const mocks = vi.hoisted(() => ({
  acceptAccessToken: vi.fn(),
  exchangeOAuthCode: vi.fn(),
  cancelSocialLogin: vi.fn(),
  consumeReturnTo: vi.fn(() => "/"),
  notify: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    acceptAccessToken: mocks.acceptAccessToken,
    cancelSocialLogin: mocks.cancelSocialLogin,
    consumeReturnTo: mocks.consumeReturnTo,
  }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: { exchangeOAuthCode: mocks.exchangeOAuthCode },
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));

describe("OAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    mocks.acceptAccessToken.mockResolvedValue(undefined);
  });

  it("StrictMode에서도 1회용 code를 한 번만 교환하고 로그인한다", async () => {
    mocks.exchangeOAuthCode.mockResolvedValue({ type: "LOGIN", accessToken: "access-token" });
    window.history.replaceState(null, "", "/oauth2/callback?code=one-time-code");

    render(<StrictMode><OAuthCallback /></StrictMode>);

    await waitFor(() => expect(mocks.acceptAccessToken).toHaveBeenCalledWith("access-token"));
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledWith("one-time-code");
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(window.location.search).toBe("");
  });

  it("소셜 로그인이 취소되면 오류 페이지 없이 지도 로그인 모달로 복귀시킨다", async () => {
    window.history.replaceState(null, "", "/oauth2/callback?error=access_denied");
    render(<OAuthCallback />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.cancelSocialLogin).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeOAuthCode).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("bbangbat.map-login-modal")).toBe("/");
    expect(screen.queryByText("로그인 정보를 확인하지 못했어요.")).not.toBeInTheDocument();
  });
});
