import Image from "next/image";
import Link from "next/link";

/** The Crafter Station isotype in its play livery, next to the wordmark. */
export function Brand({ as = "link" }: { as?: "link" | "span" }) {
  const inner = (
    <>
      <Image
        src="/brand/craft-ones-mark.svg"
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
