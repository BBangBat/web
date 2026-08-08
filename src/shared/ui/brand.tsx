import Image from "next/image";
import Link from "next/link";
import brandIcon from "@/app/icon.jpg";

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
        <Image
          src={brandIcon}
          alt=""
          width={compact ? 30 : 33}
          height={compact ? 30 : 33}
          priority
        />
      </span>
      {!iconOnly ? (
        <span className={compact ? "text-[1.05rem]" : "text-[1.25rem]"}>빵밭</span>
      ) : null}
    </Link>
  );
}
