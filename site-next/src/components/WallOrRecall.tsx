"use client";

import { useState } from "react";
import { Panel, Sev } from "./ui";
import { Chain } from "./RecallNotice";
import { cn } from "@/lib/cn";
import { num, type Consumer } from "@/lib/data";

/**
 * The same findings, presented both ways. This is the argument of the whole
 * project in one control: nothing has been filtered between the two panes —
 * the second is only grouped by the hop each finding enters through.
 */
export default function WallOrRecall({ data }: { data: Consumer }) {
  const [wall, setWall] = useState(true);
  const byKey = new Map(data.details.map((d) => [d.key, d]));

  return (
    <div>
      <div className="flex gap-2">
        {(
          [
            [true, `The wall · ${num(data.findings)} findings`],
            [false, `The recall · ${num(data.fixCount)} upgrades`],
          ] as const
        ).map(([isWall, label]) => (
          <button
            key={label}
            onClick={() => setWall(isWall)}
            aria-pressed={wall === isWall}
            className={cn(
              "rounded-xl px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
              wall === isWall
                ? "bg-white/[0.07] text-ice ring-1 ring-inset ring-white/15"
                : "text-fog ring-1 ring-inset ring-white/[0.06] hover:text-ice",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {wall ? (
          <>
            <Panel className="max-h-[340px] overflow-auto p-5">
              {data.wall.map(([label, key, osv, summary], i) => (
                <div
                  key={i}
                  className="font-mono text-[11px] leading-[1.9] whitespace-nowrap text-fog"
                >
                  <span className="inline-block w-[9ch]">{label}</span>
                  <span className="inline-block w-[38ch] text-ice/60">{key}</span>
                  <span className="text-fog/70">{osv} </span>
                  <span className="text-fog/50">{summary}</span>
                </div>
              ))}
            </Panel>
            <p className="mt-3 text-[13px] text-fog">
              {num(data.wall.length)} findings, alphabetical — the output people
              stop reading.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {data.fixes.map((f, i) => (
                <Panel key={f.package} className="p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="tnum w-[2ch] font-mono text-[11px] text-fog">
                      {i + 1}
                    </span>
                    <span className="font-mono text-[13px] break-all text-ice">
                      {f.package}
                    </span>
                    <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-fog">
                      <Sev label={f.label} score={f.score} />
                      <span>{f.vulns} versions</span>
                      <span>{f.paths} paths</span>
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {f.via.map((k) => {
                      const d = byKey.get(k);
                      if (!d) return null;
                      return (
                        <div key={k}>
                          <div className="flex flex-wrap items-baseline gap-3">
                            <Sev label={d.worst.label} />
                            <span className="font-mono text-xs text-ice/85">{d.key}</span>
                            <span className="font-mono text-[10px] text-fog">
                              {d.pathCount}×
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Chain path={d.chain} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-fog">
              The same {num(data.wall.length)} findings, grouped by what you would
              actually change. {data.fixCount > data.fixes.length &&
                `${data.fixCount - data.fixes.length} further upgrades are in the full report.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
