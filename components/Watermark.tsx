export function Watermark({
  text = "ISABEL PONTES FOTOGRAFIA",
  opacity = 0.33,
}: {
  text?: string;
  opacity?: number;
}) {
  const lines = Array.from({ length: 6 });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
    >
      <div
        className="absolute inset-0 flex flex-col justify-center gap-3"
        style={{ transform: "rotate(-32deg)" }}
      >
        {lines.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-[11px] tracking-wider"
            style={{ color: "#2A1F18" }}
          >
            {`${text} · ${text} · ${text}`}
          </div>
        ))}
      </div>
    </div>
  );
}
