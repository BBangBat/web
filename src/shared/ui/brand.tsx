import Link from "next/link";
import { Wheat } from "lucide-react";

export function Brand({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Link href="/" className="brand" aria-label="빵밭 홈">
      <span className="brand-symbol" aria-hidden="true">
        <Wheat size={compact ? 18 : 21} strokeWidth={2.3} />
      </span>
      {!iconOnly ? (
        <span className={compact ? "text-[1.05rem]" : "text-[1.25rem]"}>빵밭</span>
      ) : null}
    </Link>
  );
}
