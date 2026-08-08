import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialLinkCallback } from "@/features/auth/social-link-callback";
import { SOCIAL_LINK_MEMBER_KEY } from "@/features/auth/social-link-flow";

const mocks = vi.hoisted(() => ({
  linkSocial: vi.fn(),
  notify: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    accessToken: "access-token",
    memberId: "7",
    status: "authenticated",
  }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: { linkSocial: mocks.linkSocial },
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));

function renderCallback(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <SocialLinkCallback />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SocialLinkCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("연동을 시작한 회원 세션으로 temp token을 교환하고 목록을 갱신한다", async () => {
    const socials = [{ provider: "NAVER" as const }, { provider: "KAKAO" as const }];
    mocks.linkSocial.mockResolvedValue(socials);
    sessionStorage.setItem(SOCIAL_LINK_MEMBER_KEY, "7");
    window.history.replaceState(
      null,
      "",
      "/oauth2/link/callback?temp_token=temporary-social-token",
    );
    const queryClient = renderCallback();

    await waitFor(() => {
      expect(mocks.linkSocial).toHaveBeenCalledWith("temporary-social-token", "access-token");
    });
    expect(queryClient.getQueryData(["member-socials", "7"])).toEqual(socials);
    expect(mocks.notify).toHaveBeenCalledWith("소셜 계정을 연동했어요.", "success");
    expect(mocks.replace).toHaveBeenCalledWith("/mypage?tab=profile");
    expect(window.location.search).toBe("");
  });

  it("이미 다른 회원에게 연동된 소셜 오류를 이해하기 쉬운 문구로 표시한다", async () => {
    window.history.replaceState(
      null,
      "",
      "/oauth2/link/callback?error=already_linked",
    );
    renderCallback();

    expect(await screen.findByText("이미 다른 빵밭 계정에 연동된 소셜 계정이에요."))
      .toBeInTheDocument();
    expect(mocks.linkSocial).not.toHaveBeenCalled();
  });
});
