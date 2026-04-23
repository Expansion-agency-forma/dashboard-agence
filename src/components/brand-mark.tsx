type Size = "sm" | "md" | "lg"

const sizeMap: Record<
  Size,
  { box: string; text: string; dot: string; dotRight: string }
> = {
  sm: { box: "h-8 w-8", text: "text-sm", dot: "h-1 w-1", dotRight: "right-1.5" },
  md: {
    box: "h-10 w-10",
    text: "text-lg",
    dot: "h-1.5 w-1.5",
    dotRight: "right-2",
  },
  lg: { box: "h-12 w-12", text: "text-xl", dot: "h-2 w-2", dotRight: "right-2.5" },
}

/**
 * The Expansion brand mark — "E" letter on dark bordeaux with a gold dot,
 * matching the marketing site favicon.
 */
export function BrandMark({ size = "md" }: { size?: Size } = {}) {
  const s = sizeMap[size]
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-[#170000] text-[#c9a84c] ring-1 ring-[rgba(201,168,76,0.32)] ${s.box}`}
      aria-hidden
    >
      <span className={`font-bold tracking-tight ${s.text}`}>E</span>
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-[#c9a84c] ${s.dot} ${s.dotRight}`}
      />
    </div>
  )
}
