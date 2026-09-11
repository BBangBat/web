export function shouldPreserveSelectedCardOnDetailClose({
  isMobile,
  preserveSelectedCard,
  selectedStoreId,
  initialStoreId,
  fromBrowserHistory = false,
}: {
  isMobile: boolean;
  preserveSelectedCard: boolean;
  selectedStoreId: number | null;
  initialStoreId: number | null;
  fromBrowserHistory?: boolean;
}) {
  return isMobile
    && !fromBrowserHistory
    && preserveSelectedCard
    && selectedStoreId !== null
    && selectedStoreId === initialStoreId;
}

export function getMobileDetailHistoryStoreId(state: unknown, href: string): number | null {
  if (
    !state
    || typeof state !== "object"
    || !("bbangbatMobileDetail" in state)
    || state.bbangbatMobileDetail !== true
  ) return null;

  const storeId = Number(new URL(href).searchParams.get("storeId"));
  return Number.isInteger(storeId) && storeId > 0 ? storeId : null;
}
