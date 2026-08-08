import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/features/auth/signup-form";

const mocks = vi.hoisted(() => ({
  checkNickname: vi.fn(),
  replace: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    acceptAccessToken: vi.fn(),
    consumeReturnTo: () => "/",
  }),
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: {
    signup: vi.fn(),
    linkAccount: vi.fn(),
    checkNickname: mocks.checkNickname,
  },
}));

function renderSignup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupForm tempToken="temporary-token" existingAccount={false} />
    </QueryClientProvider>,
  );
}

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.checkNickname.mockResolvedValue({ available: true });
  });

  it("신규 회원에게 기존 계정 여부를 먼저 확인한다", () => {
    renderSignup();

    expect(screen.getByRole("heading", { name: /다른 소셜 계정으로/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "닉네임" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "기존 계정으로 로그인" }));
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(sessionStorage.getItem("bbangbat.map-login-modal")).toBe("/mypage?tab=profile");
  });

  it("새 가입 선택 후 개인정보처리방침을 먼저 표시하고 문서를 모달로 연다", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));

    const agreements = screen.getAllByRole("checkbox");
    expect(agreements[0]).toHaveAccessibleName("[필수] 개인정보처리방침 동의");
    expect(agreements[1]).toHaveAccessibleName("[필수] 서비스 이용약관 동의");

    fireEvent.click(screen.getByRole("button", { name: "개인정보처리방침 보기" }));
    expect(screen.getByRole("dialog", { name: "개인정보처리방침" })).toBeInTheDocument();
    expect(screen.getByText(/처리하는 개인정보 항목/)).toBeInTheDocument();
  });

  it("성별과 연령대는 다시 누르면 선택이 해제되는 선택 항목으로 제공한다", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));

    const femaleButton = screen.getByRole("button", { name: "여성" });
    const sixtiesButton = screen.getByRole("button", { name: "60대 이상" });
    expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /닉네임/ })).toBeRequired();
    expect(femaleButton).toHaveAttribute("aria-pressed", "false");
    expect(sixtiesButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(femaleButton);
    fireEvent.click(sixtiesButton);
    expect(femaleButton).toHaveAttribute("aria-pressed", "true");
    expect(sixtiesButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(femaleButton);
    fireEvent.click(sixtiesButton);
    expect(femaleButton).toHaveAttribute("aria-pressed", "false");
    expect(sixtiesButton).toHaveAttribute("aria-pressed", "false");
  });

  it("닉네임 입력 중 포커스를 유지한 채 사용 가능 여부를 자동 확인한다", async () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));
    const nicknameInput = screen.getByRole("textbox", { name: /닉네임/ });

    nicknameInput.focus();
    fireEvent.change(nicknameInput, { target: { value: "빵친구" } });

    expect(screen.queryByText("사용할 수 있는지 확인 중…")).not.toBeInTheDocument();
    const availableIcon = await screen.findByLabelText("사용 가능");
    expect(screen.queryByText("사용할 수 있는 닉네임이에요.")).not.toBeInTheDocument();
    expect(availableIcon.parentElement).toHaveAttribute("data-availability", "available");
    expect(mocks.checkNickname).toHaveBeenCalledWith("빵친구");
    expect(nicknameInput).toHaveFocus();
  });

  it("닉네임 정규식에 맞지 않는 입력은 타이핑 중에도 오류를 표시한다", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));
    const nicknameInput = screen.getByRole("textbox", { name: /닉네임/ });

    fireEvent.change(nicknameInput, { target: { value: "빵 친구" } });

    expect(screen.getByText("닉네임은 한글, 영문, 숫자만 2~10자로 입력해 주세요."))
      .toBeInTheDocument();
    expect(nicknameInput).toHaveAttribute("aria-invalid", "true");
    expect(mocks.checkNickname).not.toHaveBeenCalled();
  });
});
