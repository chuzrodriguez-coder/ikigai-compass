import React from "react";

interface IkigaiDiagramProps {
  title?: string;
  hypothesis?: string;
  size?: number;
  className?: string;
}

export function IkigaiDiagram({
  title,
  hypothesis,
  size,
  className = "",
}: IkigaiDiagramProps) {
  const label = title ?? "Ikigai";
  const wrapStyle = size
    ? { width: size, height: size }
    : undefined;

  return (
    <div
      className={`relative ${size ? "" : "w-full max-w-md mx-auto aspect-square"} ${className}`}
      style={wrapStyle}
      data-testid="ikigai-diagram"
    >
      <svg viewBox="0 0 400 400" className="w-full h-full text-sm font-medium">
        <defs>
          <style>
            {`
              .circle-love { fill: hsl(var(--primary) / 0.15); stroke: hsl(var(--primary) / 0.5); stroke-width: 2; }
              .circle-good { fill: hsl(var(--secondary) / 0.15); stroke: hsl(var(--secondary) / 0.5); stroke-width: 2; }
              .circle-needs { fill: hsl(var(--muted) / 0.3); stroke: hsl(var(--muted) / 0.8); stroke-width: 2; }
              .circle-pays { fill: hsl(var(--accent) / 0.5); stroke: hsl(var(--accent) / 0.8); stroke-width: 2; }
              .text-label { fill: hsl(var(--foreground)); text-anchor: middle; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }
              .text-center { fill: hsl(var(--foreground)); text-anchor: middle; font-size: 13px; font-weight: bold; font-family: var(--font-serif); }
            `}
          </style>
        </defs>

        <circle cx="200" cy="140" r="100" className="circle-love transition-all duration-500 hover:fill-[hsl(var(--primary)/0.25)]" />
        <circle cx="270" cy="220" r="100" className="circle-needs transition-all duration-500 hover:fill-[hsl(var(--muted)/0.4)]" />
        <circle cx="200" cy="270" r="100" className="circle-pays transition-all duration-500 hover:fill-[hsl(var(--accent)/0.7)]" />
        <circle cx="130" cy="220" r="100" className="circle-good transition-all duration-500 hover:fill-[hsl(var(--secondary)/0.25)]" />

        <text x="200" y="52" className="text-label">What you LOVE</text>
        <text x="345" y="215" className="text-label" style={{ fontSize: 10 }}>World&apos;s NEEDS</text>
        <text x="200" y="390" className="text-label">SUSTAINS you</text>
        <text x="55" y="215" className="text-label" style={{ fontSize: 10 }}>GOOD AT</text>

        <text x="200" y="130" className="text-label" style={{ fontSize: 10, opacity: 0.7 }}>Passion</text>
        <text x="268" y="185" className="text-label" style={{ fontSize: 10, opacity: 0.7 }}>Mission</text>
        <text x="200" y="308" className="text-label" style={{ fontSize: 10, opacity: 0.7 }}>Profession</text>
        <text x="132" y="185" className="text-label" style={{ fontSize: 10, opacity: 0.7 }}>Vocation</text>

        <text x="200" y="205" className="text-center">{label}</text>
        {hypothesis && (
          <foreignObject x="160" y="210" width="80" height="40">
            <div style={{ fontSize: 9, textAlign: "center", color: "hsl(var(--muted-foreground))", lineHeight: 1.2 }}>
              {hypothesis.length > 30 ? hypothesis.slice(0, 30) + "…" : hypothesis}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
