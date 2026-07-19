import { HOT_TIER_INTENSITY, PriceTagVariantColors, type PriceTagVariant } from "@/lib/brand";

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Ported from the mobile app's components/garagehunt/price-tag.tsx —
// the masking-tape badge motif every status/category/hot-tier label in the
// product uses. Same escalating border-weight/bold treatment for the
// three hot tiers, same washi-tape-strip-plus-tag shape.
export function PriceTag({
  label,
  variant = "category",
  rotate = -3,
}: {
  label: string;
  variant?: PriceTagVariant;
  rotate?: number;
}) {
  const accent = PriceTagVariantColors[variant];
  const dashed = variant === "draft";
  const intensity = HOT_TIER_INTENSITY[variant];

  return (
    <span
      className="relative mt-1.5 inline-block align-top"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span
        aria-hidden
        className="absolute -top-1.5 left-1.5 h-2.5 w-7 border"
        style={{
          backgroundColor: withAlpha(accent, 0.22),
          borderColor: withAlpha(accent, 0.35),
          transform: "rotate(-6deg)",
        }}
      />
      <span
        className="relative flex items-center gap-1.5 rounded-[3px] bg-paper py-1 pr-2.5 pl-4"
        style={{
          borderWidth: intensity?.borderWidth ?? 1.5,
          borderColor: withAlpha(accent, 0.4),
          borderStyle: dashed ? "dashed" : "solid",
        }}
      >
        <span
          aria-hidden
          className="absolute left-1.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: withAlpha(accent, 0.55) }}
        />
        <span
          className={`font-tag text-xs text-ink ${intensity?.bold ? "font-bold" : ""}`}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
