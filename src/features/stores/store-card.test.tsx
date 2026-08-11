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

  it("탐색 목록 카드는 사진과 주소 대신 가게명, 혼잡도, 빵명록 수를 보여준다", () => {
    render(
      <StoreCard
        store={{ ...store, reviewCount: 12 }}
        congestion={{
          storeId: store.id,
          current: "NORMAL",
          uncrowdedVotes: 1,
          normalVotes: 2,
          crowdedVotes: 0,
          totalVotes: 3,
        }}
        explore
        showCongestion
      />,
    );

    expect(screen.getByRole("link", { name: /테스트 빵집/ })).toBeInTheDocument();
    expect(screen.getByText("보통")).toBeInTheDocument();
    expect(screen.getByText("중구 중앙로 1")).toBeInTheDocument();
    expect(screen.getByText("빵명록 12")).toBeInTheDocument();
    expect(screen.queryByText(store.address)).not.toBeInTheDocument();
  });

  it("혼잡도를 불러오는 동안에는 임시 문구를 표시하지 않는다", () => {
    render(<StoreCard store={store} explore showCongestion />);

    expect(screen.queryByText("확인 중")).not.toBeInTheDocument();
  });

  it("모바일 선택 및 마이페이지용 축소 카드에도 같은 요약 구성을 사용한다", () => {
    render(
      <StoreCard
        store={{ ...store, reviewCount: 3 }}
        congestion={{
          storeId: store.id,
          current: "CROWDED",
          uncrowdedVotes: 0,
          normalVotes: 1,
          crowdedVotes: 2,
          totalVotes: 3,
        }}
        dense
        showCongestion
      />,
    );

    expect(screen.getByText("혼잡")).toBeInTheDocument();
    expect(screen.getByText("중구 중앙로 1")).toBeInTheDocument();
    expect(screen.getByText("빵명록 3")).toBeInTheDocument();
    expect(screen.queryByText(store.address)).not.toBeInTheDocument();
  });
});
