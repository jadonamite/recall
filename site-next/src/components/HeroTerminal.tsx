import { Terminal, Prompt, Out } from "./Terminal";
import { Sev } from "./ui";
import { site, num, type Consumer } from "@/lib/data";

/**
 * The command, and what it actually prints. Every figure is read from the same
 * measured dataset the rest of the page uses, so this transcript is the CLI's
 * real output for a public repository rather than a mock-up of one.
 */
export default function HeroTerminal({ data }: { data: Consumer }) {
  const sev = Object.entries(data.severities)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k.toLowerCase()}`)
    .join(" · ");

  // Distinct vulnerable versions, derived from the wall rather than counted
  // again — the wall is one row per (version, advisory) pair.
  const versions = new Set(data.wall.map((w) => w[1])).size;
  const top = data.fixes.slice(0, 5);
  const pad = Math.max(...top.map((f) => String(f.vulns).length));

  return (
    <Terminal
      title={`recall — ${data.sourceLabel ?? data.root}`}
      footer={
        <>
          {num(site.graph.packages)} packages of public graph on HydraDB ·
          traversal {site.graph.traversalSeconds}s
        </>
      }
    >
      <Prompt>npm run recall ~/code/{data.root.split("@")[0]}</Prompt>
      <Out className="mt-3">
        <span className="text-ice">{data.root}</span>
        {"  ·  exact (package-lock.json)"}
      </Out>
      <Out>
        {"  "}
        {num(data.packages)} packages · {num(data.edges)} edges
      </Out>
      <Out />
      <Out>
        <span className="text-ice">{num(data.findings)} findings</span> across{" "}
        {num(versions)} vulnerable versions
      </Out>
      <Out>{`  ${sev}`}</Out>
      <Out className="text-act">↓</Out>
      <Out>
        <span className="text-act-soft">
          {num(data.fixCount)} direct dependencies to upgrade:
        </span>
      </Out>
      <Out />
      {top.map((f) => (
        <div
          key={f.package}
          className="flex flex-wrap items-center gap-x-3 font-mono text-[12.5px] leading-relaxed"
        >
          <span className="w-2" />
          <Sev label={f.label} score={f.score} />
          <span className="tnum text-fog">
            {String(f.vulns).padStart(pad, " ")} versions
          </span>
          <span className="text-fog/60">·</span>
          <span className="tnum text-fog">{f.paths} paths</span>
          <span className="text-fog/60">·</span>
          <span className="break-all text-ice">{f.package}</span>
        </div>
      ))}
      <Out className="mt-1">
        {"  … "}
        {num(data.fixCount - top.length)} more, ordered by the worst thing each
        one carries
      </Out>
    </Terminal>
  );
}
