import Image from "next/image";
import brandIcon from "@/app/icon.jpg";

export function MemberAvatar({
  imageUrl,
  className = "",
}: {
  imageUrl?: string | null;
  className?: string;
}) {
  return (
    <span className={`member-avatar ${className}`.trim()} aria-hidden="true">
      {imageUrl ? (
        <span className="member-avatar-image" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : (
        <Image src={brandIcon} alt="" width={96} height={96} priority />
      )}
    </span>
  );
}
