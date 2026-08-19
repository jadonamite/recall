"use client";

import { useState } from "react";
import { Panel, Sev } from "./ui";
import { cn } from "@/lib/cn";
import { num, type Notice } from "@/lib/data";

/**
 * The centrepiece: the maintainer's question. Pick a compromised package and
 * the panel answers who ships it, by what chain, and which upgrades close the
 * most of it — the query a manifest-first scanner cannot express at all.
 *
 * Every figure is measured. The picker switches between real subjects rather
 * than animating one, because the point is that this holds for any of them.
 */

export function Chain({ path }: { path: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-mid/70 px-3 py-2 ring-1 ring-inset ring-white/[0.05]">
      {path.map((hop, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[9px] text-fog/60">▸</span>}
          <span
            className={cn(
              "font-mono text-[11px]",
              i === 0
                ? "text-act-soft"
                : i === path.length - 1
                  ? "rounded-md bg-lose/10 px-1.5 py-0.5 text-ice ring-1 ring-inset ring-lose/30"
                  : "text-fog",
            )}
          >
            {hop}
          </span>
        </span>
      ))}
    </div>
  );
}

function Stat({
  n,
  k,
  tone,
}: {
  n: string;
  k: string;
  tone: "hit" | "fix";
}) {
  return (
    <div>
      <div
        className={cn(
          "tnum text-[2rem] font-extrabold leading-none tracking-[-0.04em] lg:text-[2.4rem]",
          tone === "hit" ? "text-lose" : "text-act-soft",
        )}
      >
        {n}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
        {k}
      </div>
    </div>
  );
}

/**
 * `compact` is for the horizontal deck, where the whole card has one screen to
 * live in. It drops the hop-distance histogram and the full notify list — both
 * are elaboration on a number that is already stated above them — and keeps the
 * subject, the reach, the ranked upgrades and the sample chains, which are the
 * claim itself.
 */
export default function RecallNotice({
  notices,
  compact = false,
}: {
  notices: Notice[];
  compact?: boolean;
}) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = notices[i];
  const max = Math.max(...n.byDepth.map((d) => d[1]));

  return (
    <Panel className="overflow-hidden">
      {/* subject picker */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/[0.07] p-4">
        {notices.map((s, idx) => (
          <button
            key={s.package}
            onClick={() => {
              setI(idx);
              setOpen(false);
            }}
            aria-pressed={idx === i}
            className={cn(
              "flex-none rounded-xl px-3.5 py-2 font-mono text-xs transition-colors",
              idx === i
                ? "bg-act/15 text-act-soft ring-1 ring-inset ring-act/40"
                : "text-fog ring-1 ring-inset ring-white/[0.07] hover:text-ice hover:ring-white/20",
            )}
          >
            {s.package}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.05fr_1fr]">
        {/* left: the subject and its reach */}
        <div
          className={cn(
            "border-b border-white/[0.07] lg:border-r lg:border-b-0",
            compact ? "p-6" : "p-7 lg:p-9",
          )}
        >
          <div className="font-mono text-[15px] break-all text-ice">{n.package}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Sev label={n.worst.label} score={n.worst.score} />
            <span className="font-mono text-[11px] text-fog">{n.worst.osv}</span>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ice/70">
            {n.worst.summary}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <Stat n={num(n.dependents)} k="packages to notify" tone="hit" />
            <Stat n={num(n.paths)} k="distinct chains" tone="hit" />
            <Stat n={num(n.cuts.length)} k="upgrades that close them" tone="fix" />
          </div>

          {/* In the deck the chains live under the reach they explain, so the
              two columns end at roughly the same height and the panel fits one
              screen. In the full layout they stay beside the upgrades. */}
          {compact && (
            <>
              <div className="mt-7 font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
                Sample chains, app first
              </div>
              <div className="mt-4 space-y-1.5">
                {n.chains.slice(0, 2).map((c, idx) => (
                  <Chain key={idx} path={c} />
                ))}
              </div>
            </>
          )}

          <div className={compact ? "hidden" : "mt-9"}>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
              Chains by hop distance
            </div>
            <div className="mt-4 space-y-1.5">
              {n.byDepth.map(([hops, count]) => (
                <div key={hops} className="flex items-center gap-3">
                  <span className="w-[7ch] flex-none font-mono text-[11px] whitespace-nowrap text-fog">
                    {hops} {hops === 1 ? "hop" : "hops"}
                  </span>
                  <span
                    className="h-[7px] rounded-full bg-gradient-to-r from-act to-act-soft"
                    style={{ width: `${Math.max(2, (count / max) * 100)}%` }}
                  />
                  <span className="tnum font-mono text-[11px] text-fog">{num(count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={compact ? "hidden" : "mt-8"}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog transition-colors hover:text-ice"
            >
              {open ? "▾" : "▸"} The notice list — all {num(n.dependents)} packages
            </button>
            {open && (
              <div className="mt-4 max-h-56 overflow-auto rounded-xl bg-mid/70 p-4 ring-1 ring-inset ring-white/[0.05] sm:columns-2">
                {n.notify.map((p) => (
                  <div
                    key={p}
                    className="break-inside-avoid font-mono text-[11px] leading-relaxed break-all text-fog"
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right: what to do, and the proof */}
        <div className={compact ? "p-6" : "p-7 lg:p-9"}>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
            Upgrade these, in this order
          </div>
          <div className="mt-4">
            {n.cuts.slice(0, compact ? 5 : 6).map((c) => (
              <div
                key={c.package}
                className="flex items-baseline gap-3 border-t border-white/[0.05] py-2.5 first:border-t-0"
              >
                <span className="tnum w-[5ch] flex-none text-right font-mono text-xs font-bold text-act-soft">
                  {num(c.severs)}
                </span>
                <span className="font-mono text-xs break-all text-ice/85">{c.package}</span>
                <span className="ml-auto font-mono text-[10px] whitespace-nowrap text-fog">
                  {c.dependents} deps
                </span>
              </div>
            ))}
            {n.cuts.length > (compact ? 5 : 6) && (
              <div className="pt-2 font-mono text-[11px] text-fog">
                + {n.cuts.length - (compact ? 5 : 6)} more
              </div>
            )}
          </div>

          {!compact && (
            <>
              <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
                Sample chains, app first
              </div>
              <div className="mt-4 space-y-1.5">
                {n.chains.slice(0, 5).map((c, idx) => (
                  <Chain key={idx} path={c} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
