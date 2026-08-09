import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshStatus, ReviewPhotoGallery } from "@/features/stores/store-map-panel";

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

describe("ReviewPhotoGallery", () => {
  it("옆에 보이는 사진을 클릭하면 클릭한 사진으로 이동하고 순환하지 않는다", () => {
    render(<ReviewPhotoGallery imageUrls={["/first.jpg", "/second.jpg"]} />);

    const firstPhoto = screen.getByRole("button", { name: /사진 1\/2/ });
    const secondPhoto = screen.getByRole("button", { name: /사진 2\/2/ });
    const gallery = firstPhoto.parentElement as HTMLDivElement;
    const scrollTo = vi.fn();
    gallery.scrollTo = scrollTo;
    gallery.setPointerCapture = vi.fn();
    gallery.hasPointerCapture = vi.fn(() => false);
    gallery.releasePointerCapture = vi.fn();
    Object.defineProperty(secondPhoto, "offsetLeft", { configurable: true, value: 180 });

    fireEvent.pointerDown(secondPhoto, { pointerId: 1, pointerType: "mouse", clientX: 20 });
    fireEvent.pointerUp(secondPhoto, { pointerId: 1, pointerType: "mouse", clientX: 20 });
    fireEvent.click(secondPhoto);

    expect(scrollTo).toHaveBeenCalledWith({ left: 180, behavior: "smooth" });
    expect(gallery.setPointerCapture).not.toHaveBeenCalled();

    fireEvent.click(secondPhoto);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 180, behavior: "smooth" });
  });
});
