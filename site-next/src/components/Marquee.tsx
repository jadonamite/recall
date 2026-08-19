"use client";

import { site } from "@/lib/data";

/**
 * The noise, made visible. Columns of real advisory rows from the jitsi-meet
 * scan drift continuously behind the hero type — adjacent columns run in
 * opposite directions so nothing in the field ever settles.
 *
 * Every string here is real, out of the same dataset the rest of the page is
 * measured from. It is the wall the product exists to answer, used as the
 * ground it stands on.
 *
 * Pure CSS: two copies of each column translated by exactly -50%, so the loop
 * has no seam. No scroll listener, no layout work per frame.
 */

const COLUMNS = 5;
const PER_COLUMN = 16;

export default function Marquee() {
  const rows = site.consumer?.wall ?? [];
  if (!rows.length) return null;

  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    Array.from(
      { length: PER_COLUMN },
      (_, r) => rows[(c * PER_COLUMN + r) % rows.length],
    ),
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <div className="flex h-full gap-8 opacity-[0.16]">
        {columns.map((col, i) => (
          <div key={i} className="flex-1 overflow-hidden">
            <div
              className={i % 2 ? "marquee-down" : "marquee-up"}
              style={{ animationDuration: `${52 + i * 11}s` }}
            >
              {[0, 1].map((copy) => (
                <div key={copy}>
                  {col.map(([label, key, osv], j) => (
                    <div
                      key={`${copy}-${j}`}
                      className="py-1.5 font-mono text-[10.5px] leading-tight whitespace-nowrap"
                    >
                      <span
                        className={
                          label === "CRITICAL"
                            ? "text-lose/80"
                            : label === "HIGH"
                              ? "text-gold/70"
                              : "text-fog/60"
                        }
                      >
                        {label}
                      </span>{" "}
                      <span className="text-ice/50">{key}</span>{" "}
                      <span className="text-fog/40">{osv}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* the field has to die out where the type begins, or it competes with it */}
      <div className="absolute inset-0 bg-[radial-gradient(58rem_36rem_at_28%_46%,var(--color-mid)_38%,transparent_78%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-mid to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-mid to-transparent" />
    </div>
  );
}
