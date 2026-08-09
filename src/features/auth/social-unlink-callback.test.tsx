import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialUnlinkCallback } from "@/features/auth/social-unlink-callback";
import {
  readSocialUnlinkRequest,
  storeSocialUnlinkRequest,
} from "@/features/auth/social-unlink-flow";

const mocks = vi.hoisted(() => ({
  exchangeOAuthCode: vi.fn(),
  unlinkSocial: vi.fn(),
  notify: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    accessToken: "existing-access-token",
    memberId: "7",
    status: "authenticated",
  }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: {
    exchangeOAuthCode: mocks.exchangeOAuthCode,
    unlinkSocial: mocks.unlinkSocial,
  },
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));

function renderCallback(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <SocialUnlinkCallback />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SocialUnlinkCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("UNLINK code를 교환한 제공자로 기존 로그인 세션을 유지하며 연동 해제를 재시도한다", async () => {
    mocks.exchangeOAuthCode.mockResolvedValue({ type: "UNLINK", provider: "KAKAO" });
    mocks.unlinkSocial.mockResolvedValue(undefined);
    storeSocialUnlinkRequest({ action: "unlink-social", memberId: "7", provider: "KAKAO" });
    window.history.replaceState(null, "", "/oauth2/unlink/callback?code=unlink-code");
    renderCallback();

    await waitFor(() => {
      expect(mocks.unlinkSocial).toHaveBeenCalledWith("KAKAO", "existing-access-token");
    });
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledWith("unlink-code");
    expect(mocks.notify).toHaveBeenCalledWith("카카오 계정 연동을 해제했어요.", "success");
    expect(mocks.replace).toHaveBeenCalledWith("/mypage?tab=profile");
    expect(readSocialUnlinkRequest()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("회원 탈퇴 재인증은 소셜 연동을 지우지 않고 기존 탈퇴 완료 단계로 돌아간다", async () => {
    mocks.exchangeOAuthCode.mockResolvedValue({ type: "UNLINK", provider: "NAVER" });
    storeSocialUnlinkRequest({ action: "withdraw-member", memberId: "7", provider: "NAVER" });
    window.history.replaceState(null, "", "/oauth2/unlink/callback?code=withdraw-code");
    renderCallback();

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/mypage?tab=profile&withdraw=reauthenticated");
    });
    expect(mocks.unlinkSocial).not.toHaveBeenCalled();
    expect(readSocialUnlinkRequest()).toEqual({
      action: "withdraw-member",
      memberId: "7",
      provider: "NAVER",
    });
  });

  it("재인증한 제공자가 요청한 제공자와 다르면 연동 해제를 실행하지 않는다", async () => {
    mocks.exchangeOAuthCode.mockResolvedValue({ type: "UNLINK", provider: "NAVER" });
    storeSocialUnlinkRequest({ action: "unlink-social", memberId: "7", provider: "KAKAO" });
    window.history.replaceState(null, "", "/oauth2/unlink/callback?code=mismatched-code");
    renderCallback();

    await waitFor(() => {
      expect(mocks.notify).toHaveBeenCalledWith("소셜 계정 확인 결과가 올바르지 않아요.", "error");
    });
    expect(mocks.unlinkSocial).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/mypage?tab=profile");
  });
});
