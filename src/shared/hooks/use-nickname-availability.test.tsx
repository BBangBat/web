import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNicknameAvailability } from "@/shared/hooks/use-nickname-availability";

const mocks = vi.hoisted(() => ({ checkNickname: vi.fn() }));

vi.mock("@/shared/api/bbangbat-api", () => ({
  bbangbatApi: { checkNickname: mocks.checkNickname },
}));

function AvailabilityProbe({
  nickname,
  currentNickname,
}: {
  nickname: string;
  currentNickname?: string;
}) {
  const { status } = useNicknameAvailability({ nickname, currentNickname });
  return <span>{status}</span>;
}

describe("useNicknameAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkNickname.mockResolvedValue({ available: true });
  });

  it("현재 닉네임은 다시 조회하지 않고 변경한 닉네임만 확인한다", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <AvailabilityProbe nickname="빵친구" currentNickname="빵친구" />
      </QueryClientProvider>,
    );

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 400)));
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(mocks.checkNickname).not.toHaveBeenCalled();

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AvailabilityProbe nickname="새빵친구" currentNickname="빵친구" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("available")).toBeInTheDocument();
    expect(mocks.checkNickname).toHaveBeenCalledWith("새빵친구");
  });
});
