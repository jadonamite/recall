import { Panel, Reveal, Ticked } from "./ui";

/**
 * Mixed-weight block grid. Every tile carries a drawn visual rather than an
 * icon: "icon + title + two lines, times four" is the shape that makes a page
 * read as a template. Each visual is inline SVG on the isometric field, so it
 * stays crisp at any size and needs no assets.
 */

/**
 * The visual's stage. It sits in flow beneath the copy rather than absolutely
 * behind it — overlapping a drawn diagram with a checklist made both unreadable,
 * and the reference layout only appears to overlap because its cards are taller
 * than their text.
 */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mt-auto -mx-8 -mb-8 h-[220px] overflow-hidden rounded-b-[1.75rem] lg:-mx-10 lg:-mb-10">
      <div className="iso-field absolute inset-0 opacity-100" />
      <span aria-hidden className="pointer-events-none absolute right-16 bottom-0 h-40 w-56 rounded-full bg-act/15 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-mid/70 via-transparent to-transparent" />
      <div className="absolute right-2 -bottom-1 lg:right-6">{children}</div>
    </div>
  );
}

/** Two live copies of one package: the edge a flat scanner collapses. */
function ShadowingVisual() {
  return (
    <svg viewBox="0 0 220 150" className="h-[200px] w-[295px]" aria-hidden>
      <defs>
        <linearGradient id="cool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d74ff" stopOpacity=".95" />
          <stop offset="1" stopColor="#7aa2ff" stopOpacity=".55" />
        </linearGradient>
      </defs>
      {/* base plate */}
      <g stroke="#ffffff" strokeOpacity=".14" fill="none">
        <path d="M110 128 24 96l86-32 86 32z" />
      </g>
      {/* hoisted copy, dim */}
      <g transform="translate(46 52)">
        <path d="M0 26 32 14l32 12-32 12z" fill="#1e2840" stroke="#ffffff" strokeOpacity=".18" />
        <path d="M0 26v14l32 12V38z" fill="#141b2e" stroke="#ffffff" strokeOpacity=".12" />
        <path d="M64 26v14L32 52V38z" fill="#0f1524" stroke="#ffffff" strokeOpacity=".1" />
      </g>
      {/* nested copy, lit — the one that actually reaches */}
      <g transform="translate(104 22)">
        <path d="M0 26 32 14l32 12-32 12z" fill="url(#cool)" />
        <path d="M0 26v14l32 12V38z" fill="#2b56c4" />
        <path d="M64 26v14L32 52V38z" fill="#1d3c8f" />
        <circle cx="32" cy="4" r="3.4" fill="#7aa2ff" />
      </g>
      <text x="12" y="126" fill="#8e96ab" fontSize="9" fontFamily="var(--font-mono)">
        node_modules/
      </text>
    </svg>
  );
}

/** The traversal: an arrow climbing back up the branch. */
function UpwardVisual() {
  return (
    <svg viewBox="0 0 220 150" className="h-[200px] w-[295px]" aria-hidden>
      <g fill="none" stroke="#ffffff" strokeOpacity=".16">
        <path d="M40 122h150" />
      </g>
      {/* branch, bottom (compromised) to top (app) */}
      <g fill="none" stroke="#3d74ff" strokeOpacity=".55" strokeWidth="1.6">
        <path d="M60 112 96 84M96 84l34-26M130 58l32-24" />
      </g>
      {[
        [60, 112, 4, "#ff6b5e"],
        [96, 84, 3.4, "#7aa2ff"],
        [130, 58, 3.4, "#7aa2ff"],
        [162, 34, 5, "#31d3a2"],
      ].map(([x, y, r, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} />
      ))}
      {/* direction of travel */}
      <g stroke="#edf0f7" strokeOpacity=".8" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M74 128l84-64" strokeDasharray="4 5" strokeOpacity=".35" />
        <path d="M152 70l10-8 1 12" />
      </g>
      <text x="34" y="140" fill="#8e96ab" fontSize="9" fontFamily="var(--font-mono)">
        compromised → app
      </text>
    </svg>
  );
}

/** Advisory windows on a version axis. */
function WindowVisual() {
  return (
    <svg viewBox="0 0 220 150" className="h-[200px] w-[295px]" aria-hidden>
      <g stroke="#ffffff" strokeOpacity=".14">
        <path d="M20 104h180" />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${28 + i * 32} 100v8`}
          stroke="#ffffff"
          strokeOpacity=".2"
        />
      ))}
      {/* affected band */}
      <rect x="60" y="74" width="86" height="12" rx="6" fill="#ff6b5e" fillOpacity=".8" />
      <text x="60" y="66" fill="#ff6b5e" fontSize="9" fontFamily="var(--font-mono)">
        affected
      </text>
      {/* patched band */}
      <rect x="146" y="74" width="52" height="12" rx="6" fill="#31d3a2" fillOpacity=".75" />
      <text x="146" y="66" fill="#31d3a2" fontSize="9" fontFamily="var(--font-mono)">
        fixed
      </text>
      {/* the pinned version, sitting inside the window */}
      <g>
        <path d="M104 86v18" stroke="#edf0f7" strokeOpacity=".7" strokeWidth="1.4" />
        <circle cx="104" cy="80" r="4.5" fill="#edf0f7" />
      </g>
      <text x="20" y="130" fill="#8e96ab" fontSize="9" fontFamily="var(--font-mono)">
        your pinned version
      </text>
    </svg>
  );
}

/** Many findings collapsing onto few upgrades. */
function CollapseVisual() {
  return (
    <svg viewBox="0 0 220 150" className="h-[200px] w-[295px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <rect
          key={i}
          x={18}
          y={22 + i * 11}
          width={62}
          height={5}
          rx={2.5}
          fill="#8e96ab"
          fillOpacity={0.28}
        />
      ))}
      <g stroke="#3d74ff" strokeOpacity=".5" fill="none">
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M84 ${46 + i * 22}C112 ${46 + i * 22} 116 ${52 + i * 18} 138 ${52 + i * 18}`} />
        ))}
      </g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={142}
          y={46 + i * 18}
          width={60}
          height={12}
          rx={6}
          fill="#3d74ff"
          fillOpacity={0.9 - i * 0.18}
        />
      ))}
      <text x="18" y="136" fill="#8e96ab" fontSize="9" fontFamily="var(--font-mono)">
        findings
      </text>
      <text x="150" y="136" fill="#7aa2ff" fontSize="9" fontFamily="var(--font-mono)">
        upgrades
      </text>
    </svg>
  );
}

type Block = {
  title: React.ReactNode;
  body: string;
  ticks: string[];
  visual: React.ReactNode;
  wide?: boolean;
};

const BLOCKS: Block[] = [
  {
    title: "Resolution that keeps the copies apart",
    body: "npm resolves positionally, so one project routinely holds several live versions of the same package. Recall replays that lookup instead of flattening it.",
    ticks: [
      "Exact, offline, from package-lock.json",
      "Nested copies stay distinct from hoisted ones",
      "Falls back to deps.dev, and says so",
    ],
    visual: <ShadowingVisual />,
    wide: true,
  },
  {
    title: "Traversal that runs upward",
    body: "The graph is walked from the compromised package back toward the applications that ship it.",
    ticks: ["Native reverse traversal", "Full chains, not booleans", "Depth profile per package"],
    visual: <UpwardVisual />,
  },
  {
    title: "Advisories are ranges, not labels",
    body: "A version is exposed only if it sits inside an affected window, so patched and pre-release versions stop showing up as findings.",
    ticks: ["introduced → fixed windows", "CVSS v3 scored from the vector", "Unparseable is never called safe"],
    visual: <WindowVisual />,
  },
  {
    title: "A short, ordered list of fixes",
    body: "Every chain enters through one direct dependency. Group by that hop and the wall becomes something you can work through.",
    ticks: [
      "Ranked by worst severity carried",
      "Paths severed per upgrade",
      "Nothing filtered out on the way",
    ],
    visual: <CollapseVisual />,
    wide: true,
  },
];

export default function Blocks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-3 lg:grid-cols-2" : "grid gap-4 lg:grid-cols-5"}>
      {BLOCKS.map((b, i) => (
        <Reveal
          key={i}
          delay={i * 0.06}
          className={
            compact ? "" : b.wide ? "lg:col-span-3" : "lg:col-span-2"
          }
        >
          <Panel
            interactive
            className={
              compact
                ? "flex h-full flex-col overflow-hidden p-6"
                : "flex h-full min-h-[420px] flex-col overflow-hidden p-8 lg:p-10"
            }
          >
            <h3
              className={
                compact
                  ? "max-w-[26ch] text-lg font-bold leading-tight tracking-tight text-ice"
                  : "max-w-[24ch] text-2xl font-bold leading-tight tracking-tight text-ice"
              }
            >
              {b.title}
            </h3>
            <p
              className={
                compact
                  ? "mt-2 max-w-md text-[13.5px] leading-relaxed text-ice/70"
                  : "mt-3 max-w-md text-[15px] leading-relaxed text-ice/70"
              }
            >
              {b.body}
            </p>
            <ul className={compact ? "mt-4 space-y-2" : "mt-6 space-y-2.5"}>
              {b.ticks.map((t) => (
                <Ticked key={t}>{t}</Ticked>
              ))}
            </ul>
            {/* The isometric visual is the first thing to go when four cards
                have to share one screen — it is atmosphere, and the ticks
                above it are the evidence. */}
            {!compact && <Field>{b.visual}</Field>}
          </Panel>
        </Reveal>
      ))}
    </div>
  );
}
