import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshStatus } from "@/features/stores/store-map-panel";

describe("RefreshStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Strict Mode에서 초기 회전이 끝난 뒤 다시 클릭할 수 있다", () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();

    render(
      <StrictMode>
        <RefreshStatus label="실시간 톡" updatedAt={Date.now()} isFetching onRefresh={onRefresh} />
      </StrictMode>,
    );

    const button = screen.getByRole("button", { name: /실시간 톡 새로고침/ });
    expect(button).toBeDisabled();

    act(() => vi.advanceTimersByTime(800));
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
