"use client";

import { useState } from "react";
import { Sev } from "./ui";
import { Terminal } from "./Terminal";
import { Chain } from "./RecallNotice";
import { cn } from "@/lib/cn";
import { num, type Consumer } from "@/lib/data";

/**
 * The same findings, presented both ways. This is the argument of the whole
 * project in one control: nothing has been filtered between the two panes — the
 * second is only grouped by the hop each finding enters through.
 *
 * Both panes scroll inside a fixed-height terminal body. An earlier version let
 * the grouped pane grow to its natural height, which added several screens to
 * the page and turned "here is the short list" into another long one.
 */
export default function WallOrRecall({ data }: { data: Consumer }) {
  const [wall, setWall] = useState(true);
  const byKey = new Map(data.details.map((d) => [d.key, d]));
  const shown = data.fixes.length;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
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
          <Terminal
            title="npm audit — the output people stop reading"
            scroll="24rem"
            footer={`${num(data.wall.length)} findings, alphabetical. Scroll it — that is the point.`}
          >
            {data.wall.map(([label, key, osv, summary], i) => (
              <div
                key={i}
                className="font-mono text-[11.5px] leading-[1.9] whitespace-nowrap text-fog"
              >
                <span className="inline-block w-[9ch]">{label}</span>
                <span className="inline-block w-[38ch] text-ice/60">{key}</span>
                <span className="text-fog/70">{osv} </span>
                <span className="text-fog/50">{summary}</span>
              </div>
            ))}
          </Terminal>
        ) : (
          <Terminal
            title={`recall — ${data.sourceLabel ?? data.root}`}
            scroll="24rem"
            footer={
              <>
                The same {num(data.wall.length)} findings, grouped by what you
                would actually change.
                {data.fixCount > shown &&
                  ` Showing the worst ${shown} of ${data.fixCount}.`}
              </>
            }
          >
            <div className="space-y-4">
              {data.fixes.map((f, i) => (
                <div
                  key={f.package}
                  className="border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="tnum w-[2ch] font-mono text-[11px] text-fog">
                      {i + 1}
                    </span>
                    <Sev label={f.label} score={f.score} />
                    <span className="font-mono text-[13px] break-all text-ice">
                      {f.package}
                    </span>
                    <span className="ml-auto flex items-center gap-3 font-mono text-[11px] whitespace-nowrap text-fog">
                      <span>{f.vulns} versions</span>
                      <span>{f.paths} paths</span>
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 pl-[3ch]">
                    {f.via.slice(0, 3).map((k) => {
                      const d = byKey.get(k);
                      if (!d) return null;
                      return <Chain key={k} path={d.chain} />;
                    })}
                    {f.via.length > 3 && (
                      <div className="font-mono text-[10.5px] text-fog/70">
                        + {f.via.length - 3} more vulnerable versions behind this
                        one
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Terminal>
        )}
      </div>
    </div>
  );
}
