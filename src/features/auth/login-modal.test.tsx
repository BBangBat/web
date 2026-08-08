import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-context";
import { LoginModalProvider, useLoginModal } from "@/features/auth/login-modal";

const apiMocks = vi.hoisted(() => ({
  refreshToken: vi.fn(),
  socialLoginUrl: vi.fn((provider: string, origin: string) =>
    `https://dev-api.bbangbat.com/oauth2/authorization/${provider}?redirect_uri=${encodeURIComponent(origin)}`,
  ),
}));

vi.mock("@/shared/api/bbangbat-api", () => ({ bbangbatApi: apiMocks }));

function LoginProbe() {
  const { openLogin } = useLoginModal();
  return <button type="button" onClick={() => openLogin("/favorites")}>로그인 열기</button>;
}

describe("LoginModalProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiMocks.refreshToken.mockRejectedValue(new Error("no session"));
    vi.clearAllMocks();
  });

  it("소셜 로그인을 브라우저 기본 링크 이동으로 시작하고 복귀 경로를 저장한다", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoginModalProvider><LoginProbe /></LoginModalProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "로그인 열기" }));
    const kakaoLink = screen.getByRole("link", { name: "카카오로 시작하기" });

    expect(kakaoLink).toHaveAttribute(
      "href",
      `https://dev-api.bbangbat.com/oauth2/authorization/kakao?redirect_uri=${encodeURIComponent(window.location.origin)}`,
    );

    kakaoLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(kakaoLink);
    expect(sessionStorage.getItem("bbangbat.return-to")).toBe("/favorites");
    expect(sessionStorage.getItem("bbangbat.explicit-logout")).toBeNull();
  });
});
