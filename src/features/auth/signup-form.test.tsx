import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/features/auth/signup-form";

const mocks = vi.hoisted(() => ({
  checkNickname: vi.fn(),
  signup: vi.fn(),
  acceptAccessToken: vi.fn(),
  replace: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    acceptAccessToken: mocks.acceptAccessToken,
    consumeReturnTo: () => "/",
  }),
}));
vi.mock("@/shared/ui/feedback-provider", () => ({
  useFeedback: () => ({ notify: mocks.notify }),
}));
vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: {
    signup: mocks.signup,
    linkAccount: vi.fn(),
    checkNickname: mocks.checkNickname,
  },
}));

function renderSignup({
  initialGender,
  initialAgeGroup,
}: {
  initialGender?: "MALE" | "FEMALE" | "UNKNOWN" | null;
  initialAgeGroup?: "TEENS" | "TWENTIES" | "THIRTIES" | "FORTIES" | "FIFTIES" | "SIXTIES_PLUS" | "UNKNOWN" | null;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupForm
        tempToken="temporary-token"
        existingAccount={false}
        initialGender={initialGender}
        initialAgeGroup={initialAgeGroup}
      />
    </QueryClientProvider>,
  );
}

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.checkNickname.mockResolvedValue({ available: true });
    mocks.signup.mockResolvedValue({ accessToken: "signup-access-token" });
    mocks.acceptAccessToken.mockResolvedValue(undefined);
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

  it("소셜 성별과 연령대를 초기 선택으로 보여주고 응답하지 않음도 제공한다", () => {
    renderSignup({ initialGender: "FEMALE", initialAgeGroup: "TWENTIES" });
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));

    const femaleButton = screen.getByRole("button", { name: "여성" });
    const twentiesButton = screen.getByRole("button", { name: "20대" });
    const unknownButtons = screen.getAllByRole("button", { name: "응답하지 않음" });
    expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /닉네임/ })).toBeRequired();
    expect(femaleButton).toHaveAttribute("aria-pressed", "true");
    expect(twentiesButton).toHaveAttribute("aria-pressed", "true");
    expect(unknownButtons).toHaveLength(2);
    expect(unknownButtons[0]).toHaveAttribute("aria-pressed", "false");
    expect(unknownButtons[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("소셜 값이 없으면 성별과 연령대를 직접 선택할 때까지 가입 버튼을 비활성화한다", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));

    const unknownButtons = screen.getAllByRole("button", { name: "응답하지 않음" });
    expect(unknownButtons[0]).toHaveAttribute("aria-pressed", "false");
    expect(unknownButtons[1]).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByRole("button", { name: "빵밭 시작하기" })).toBeDisabled();
    expect(screen.queryByText("성별을 선택해 주세요.")).not.toBeInTheDocument();
    expect(screen.queryByText("연령대를 선택해 주세요.")).not.toBeInTheDocument();
    expect(screen.queryByText("필수 약관에 모두 동의해 주세요.")).not.toBeInTheDocument();
  });

  it("소셜 초기값보다 회원가입 화면에서 바꾼 값을 우선해 전송한다", async () => {
    renderSignup({ initialGender: "FEMALE", initialAgeGroup: "TWENTIES" });
    fireEvent.click(screen.getByRole("button", { name: "새로 가입하기" }));

    fireEvent.change(screen.getByRole("textbox", { name: /닉네임/ }), { target: { value: "빵친구" } });
    fireEvent.click(screen.getByRole("button", { name: "남성" }));
    fireEvent.click(screen.getByRole("button", { name: "30대" }));
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));

    await screen.findByLabelText("사용 가능");
    const submitButton = screen.getByRole("button", { name: "빵밭 시작하기" });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => expect(mocks.signup).toHaveBeenCalledWith({
      tempToken: "temporary-token",
      nickname: "빵친구",
      gender: "MALE",
      ageGroup: "THIRTIES",
      termsAgreed: true,
      privacyAgreed: true,
    }));
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
