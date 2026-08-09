import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupCallback } from "@/features/auth/signup-callback";

const mocks = vi.hoisted(() => ({
  exchangeOAuthCode: vi.fn(),
  notify: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: { exchangeOAuthCode: mocks.exchangeOAuthCode },
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));
vi.mock("@/features/auth/signup-form", () => ({
  SignupForm: ({
    tempToken,
    existingAccount,
  }: {
    tempToken: string;
    existingAccount: boolean;
  }) => (
    <div>
      <span>{tempToken}</span>
      <span>{existingAccount ? "기존 계정" : "신규 계정"}</span>
    </div>
  ),
}));

describe("SignupCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("StrictMode에서도 code를 한 번만 교환하고 가입 폼에 임시 정보를 전달한다", async () => {
    mocks.exchangeOAuthCode.mockResolvedValue({
      type: "SIGNUP",
      tempToken: "temporary-signup-token",
      existingAccount: true,
    });
    window.history.replaceState(null, "", "/signup?code=one-time-signup-code");

    render(<StrictMode><SignupCallback code="one-time-signup-code" /></StrictMode>);

    expect(await screen.findByText("temporary-signup-token")).toBeInTheDocument();
    expect(screen.getByText("기존 계정")).toBeInTheDocument();
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeOAuthCode).toHaveBeenCalledWith("one-time-signup-code");
    expect(window.location.search).toBe("");
  });

  it("code가 없으면 지도 로그인 모달로 복귀시킨다", async () => {
    render(<SignupCallback code={null} />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.exchangeOAuthCode).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("bbangbat.map-login-modal")).toBe("/");
  });
});
