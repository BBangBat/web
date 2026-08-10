export function shouldPreserveSelectedCardOnDetailClose({
  isMobile,
  preserveSelectedCard,
  selectedStoreId,
  initialStoreId,
}: {
  isMobile: boolean;
  preserveSelectedCard: boolean;
  selectedStoreId: number | null;
  initialStoreId: number | null;
}) {
  return isMobile
    && preserveSelectedCard
    && selectedStoreId !== null
    && selectedStoreId === initialStoreId;
}
