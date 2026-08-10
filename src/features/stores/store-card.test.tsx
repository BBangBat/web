import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Store } from "@/entities/types";
import { StoreCard } from "@/features/stores/store-card";

const store: Store = {
  id: 132,
  name: "테스트 빵집",
  address: "대전광역시 중구 중앙로 1",
  phoneNumber: null,
  imageUrl: "",
  latitude: 36.325,
  longitude: 127.421,
};

describe("StoreCard", () => {
  it.each([false, true])("가게 선택 핸들러가 없을 때 메인 지도 상세 패널로 연결한다 (dense=%s)", (dense) => {
    render(<StoreCard store={store} dense={dense} />);

    expect(screen.getByRole("link", { name: /테스트 빵집/ })).toHaveAttribute(
      "href",
      "/?storeId=132&detail=sidebar",
    );
  });
});
