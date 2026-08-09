import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/layout/app-navigation";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/shared/api/client";

const apiMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  socialLoginUrl: vi.fn(),
}));
const loginMocks = vi.hoisted(() => ({ openLogin: vi.fn() }));

vi.mock("@/shared/api/bbangbat-api", () => ({ bbangbatApi: apiMocks }));
vi.mock("@/features/auth/login-modal", () => ({
  useLoginModal: () => loginMocks,
}));

const accessToken = `header.${btoa(JSON.stringify({ sub: "7" }))}.signature`;
const member = {
  id: 7,
  email: "bread@example.com",
  name: "빵친구",
  nickname: "빵친구",
  profileImageUrl: null,
  gender: "FEMALE",
  ageGroup: "TWENTIES",
  lastLoginAt: null,
  createdAt: null,
};

function AuthProbe() {
  const { logout, status } = useAuth();
  return <button type="button" onClick={() => void logout()}>{status}</button>;
}

function SocialAuthProbe() {
  const { acceptAccessToken, currentSocialProvider, prepareSocialLogin } = useAuth();
  return (
    <div>
      <span data-testid="current-social-provider">{currentSocialProvider ?? "none"}</span>
      <button type="button" onClick={() => prepareSocialLogin("/", "NAVER")}>네이버 로그인 준비</button>
      <button type="button" onClick={() => void acceptAccessToken(accessToken)}>로그인 완료</button>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AuthProbe /></AuthProvider>
    </QueryClientProvider>,
  );
}

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AppHeader /></AuthProvider>
    </QueryClientProvider>,
  );
}

function renderSocialAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><SocialAuthProbe /></AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider logout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    apiMocks.getMe.mockReset();
    apiMocks.refreshToken.mockReset();
    apiMocks.logout.mockReset();
    apiMocks.socialLoginUrl.mockReset();
    loginMocks.openLogin.mockReset();
  });

  it("인증 세션을 복원하는 동안 로그인 버튼을 노출하지 않는다", async () => {
    apiMocks.refreshToken.mockRejectedValue(new Error("no session"));

    renderHeader();

    expect(screen.queryByRole("button", { name: "로그인/가입" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "로그인/가입" })).toBeInTheDocument();
  });

  it("OAuth 콜백에서는 이전 리프레시 세션을 동시에 복원하지 않는다", async () => {
    window.history.replaceState(null, "", "/oauth2/callback?code=one-time-code");

    renderAuth();

    await screen.findByRole("button", { name: "anonymous" });
    expect(apiMocks.refreshToken).not.toHaveBeenCalled();
  });

  it("OAuth가 취소된 콜백에서는 기존 로그인 세션을 다시 복원한다", async () => {
    window.history.replaceState(null, "", "/oauth2/callback?error=access_denied");
    apiMocks.refreshToken.mockResolvedValue({ accessToken });
    apiMocks.getMe.mockResolvedValue(member);

    renderAuth();

    await screen.findByRole("button", { name: "authenticated" });
    expect(apiMocks.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("저장된 토큰의 회원 조회가 일시적으로 실패해도 리프레시로 세션을 복구한다", async () => {
    sessionStorage.setItem("bbangbat.access-token", accessToken);
    apiMocks.getMe.mockRejectedValueOnce(new Error("temporary network error")).mockResolvedValueOnce(member);
    apiMocks.refreshToken.mockResolvedValue({ accessToken });

    renderAuth();

    await screen.findByRole("button", { name: "authenticated" });
    expect(apiMocks.refreshToken).toHaveBeenCalledTimes(1);
    expect(apiMocks.getMe).toHaveBeenCalledTimes(2);
  });

  it("회원 재조회가 일시적으로 실패해도 캐시된 닉네임을 유지한다", async () => {
    sessionStorage.setItem("bbangbat.access-token", accessToken);
    sessionStorage.setItem("bbangbat.member-session", JSON.stringify({ memberId: "7", member }));
    apiMocks.getMe.mockRejectedValue(new Error("temporary network error"));
    apiMocks.refreshToken.mockRejectedValue(new Error("temporary network error"));

    renderHeader();

    expect(await screen.findByText("빵친구")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "로그인/가입" })).not.toBeInTheDocument();
  });

  it("토큰 갱신 후에도 회원 조회가 401이면 잘못된 로그인 상태를 유지하지 않는다", async () => {
    sessionStorage.setItem("bbangbat.access-token", accessToken);
    sessionStorage.setItem("bbangbat.member-session", JSON.stringify({ memberId: "7", member }));
    apiMocks.getMe.mockRejectedValue(new ApiError(401, null));
    apiMocks.refreshToken.mockResolvedValue({ accessToken });

    renderHeader();

    expect(await screen.findByRole("button", { name: "로그인/가입" })).toBeInTheDocument();
    expect(sessionStorage.getItem("bbangbat.access-token")).toBeNull();
  });

  it("서버 로그아웃 실패와 관계없이 로컬 세션을 끝내고 자동 복원을 막는다", async () => {
    sessionStorage.setItem("bbangbat.access-token", accessToken);
    sessionStorage.setItem("bbangbat.current-social-provider", "NAVER");
    apiMocks.getMe.mockResolvedValue(member);
    apiMocks.logout.mockRejectedValue(new Error("network error"));

    const firstRender = renderAuth();
    await screen.findByRole("button", { name: "authenticated" });

    fireEvent.click(screen.getByRole("button", { name: "authenticated" }));
    await screen.findByRole("button", { name: "anonymous" });

    expect(sessionStorage.getItem("bbangbat.access-token")).toBeNull();
    expect(sessionStorage.getItem("bbangbat.member-session")).toBeNull();
    expect(sessionStorage.getItem("bbangbat.current-social-provider")).toBeNull();
    expect(sessionStorage.getItem("bbangbat.explicit-logout")).toBe("true");

    firstRender.unmount();
    apiMocks.getMe.mockClear();
    apiMocks.refreshToken.mockClear();

    renderAuth();
    await waitFor(() => expect(screen.getByRole("button", { name: "anonymous" })).toBeInTheDocument());
    expect(apiMocks.getMe).not.toHaveBeenCalled();
    expect(apiMocks.refreshToken).not.toHaveBeenCalled();
  });

  it("OAuth를 시작한 제공자를 로그인 완료 후 현재 소셜로 기록한다", async () => {
    window.history.replaceState(null, "", "/oauth2/callback?code=one-time-code");
    apiMocks.getMe.mockResolvedValue(member);
    renderSocialAuth();

    fireEvent.click(screen.getByRole("button", { name: "네이버 로그인 준비" }));
    expect(sessionStorage.getItem("bbangbat.pending-social-provider")).toBe("NAVER");
    fireEvent.click(screen.getByRole("button", { name: "로그인 완료" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-social-provider")).toHaveTextContent("NAVER");
    });
    expect(sessionStorage.getItem("bbangbat.current-social-provider")).toBe("NAVER");
    expect(sessionStorage.getItem("bbangbat.pending-social-provider")).toBeNull();
  });
});
