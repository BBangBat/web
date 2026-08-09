import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

function renderDialog(onCancel = vi.fn(), onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      open
      title="정말 삭제하시겠어요?"
      description="삭제한 기록은 복구할 수 없어요."
      confirmLabel="삭제하기"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  return { onCancel, onConfirm };
}

describe("ConfirmDialog", () => {
  it("확인 전에는 실행하지 않고 삭제하기를 눌렀을 때만 확인 콜백을 호출한다", () => {
    const { onConfirm } = renderDialog();

    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("취소 버튼과 Escape로 닫을 수 있다", () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
