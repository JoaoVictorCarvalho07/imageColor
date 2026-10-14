import { STUDIO_NAME } from "@/lib/studio";

const DEFAULT_TEXT = STUDIO_NAME.toUpperCase();

export function Watermark({
  text = DEFAULT_TEXT,
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
            className="whitespace-nowrap text-[11px] tracking-wider text-watermark"
          >
            {`${text} · ${text} · ${text}`}
          </div>
        ))}
      </div>
    </div>
  );
}
