import Image from "next/image";
import Link from "next/link";

export function Brand({ as = "link" }: { as?: "link" | "span" }) {
  const inner = (
    <>
      <Image
        src="/brand/craft-ones-icon.webp"
        alt=""
        width={40}
        height={40}
        priority
      />
      <span className="brand-word">
        <span>Craft</span>
        <span>Ones</span>
      </span>
    </>
  );
  return as === "link" ? (
    <Link href="/" className="brand">
      {inner}
    </Link>
  ) : (
    <span className="brand">{inner}</span>
  );
}
