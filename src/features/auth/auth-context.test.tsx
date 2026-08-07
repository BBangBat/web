import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";

const apiMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  socialLoginUrl: vi.fn(),
}));

vi.mock("@/shared/api/bbangbat-api", () => ({ bbangbatApi: apiMocks }));

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

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AuthProbe /></AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider logout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.clearAllMocks();
  });

  it("OAuth 콜백에서는 이전 리프레시 세션을 동시에 복원하지 않는다", async () => {
    window.history.replaceState(null, "", "/oauth2/callback?access_token=new-token");

    renderAuth();

    await screen.findByRole("button", { name: "anonymous" });
    expect(apiMocks.refreshToken).not.toHaveBeenCalled();
  });

  it("서버 로그아웃 실패와 관계없이 로컬 세션을 끝내고 자동 복원을 막는다", async () => {
    sessionStorage.setItem("bbangbat.access-token", accessToken);
    apiMocks.getMe.mockResolvedValue(member);
    apiMocks.logout.mockRejectedValue(new Error("network error"));

    const firstRender = renderAuth();
    await screen.findByRole("button", { name: "authenticated" });

    fireEvent.click(screen.getByRole("button", { name: "authenticated" }));
    await screen.findByRole("button", { name: "anonymous" });

    expect(sessionStorage.getItem("bbangbat.access-token")).toBeNull();
    expect(sessionStorage.getItem("bbangbat.explicit-logout")).toBe("true");

    firstRender.unmount();
    apiMocks.getMe.mockClear();
    apiMocks.refreshToken.mockClear();

    renderAuth();
    await waitFor(() => expect(screen.getByRole("button", { name: "anonymous" })).toBeInTheDocument());
    expect(apiMocks.getMe).not.toHaveBeenCalled();
    expect(apiMocks.refreshToken).not.toHaveBeenCalled();
  });
});
