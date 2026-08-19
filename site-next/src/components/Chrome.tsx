import Link from "next/link";
import { RecallMark } from "./ui";
import { Brand, IconGraph, IconLockfile, IconTerminal, IconArrow } from "./icons";
import { site, num } from "@/lib/data";

/**
 * Nav and footer. Destinations are icons with the label as their accessible
 * name; text is kept only where no icon would be honest about where the link
 * goes (the two in-page acts read better named).
 */

function NavIcon({
  href,
  label,
  children,
  external = false,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="grid h-10 w-10 place-items-center rounded-full text-fog transition-colors hover:bg-white/[0.06] hover:text-ice"
    >
      {children}
    </Link>
  );
}

export function Nav() {
  return (
    <header className="relative z-20 flex items-center justify-between py-6">
      <RecallMark />
      {/* On a phone the CTA is dropped and the destinations run to the trailing
          edge: the hero repeats "Open the tool" one screen down, so a duplicate
          up here costs the only row of width the nav has. */}
      <nav className="flex flex-1 items-center justify-end gap-1">
        <NavIcon href="/#notice" label="The recall query">
          <IconGraph />
        </NavIcon>
        <NavIcon href="/#collapse" label="Findings collapsed into upgrades">
          <IconLockfile />
        </NavIcon>
        <NavIcon
          href="https://github.com/jadonamite/recall"
          label="Source on GitHub"
          external
        >
          <Brand name="github" />
        </NavIcon>
        {/* A plain anchor, not next/link: /app is a hand-folded static page, not
            a Next route, so the client router must not prefetch or soft-navigate. */}
        <a
          href="/app/"
          className="ml-2 hidden items-center gap-2 rounded-full bg-act px-4 py-2.5 text-[13px] font-bold text-ice transition-colors hover:bg-act-soft hover:text-mid sm:inline-flex"
        >
          <IconTerminal className="h-4 w-4" />
          Open the tool
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  const cols: { head: string; links: { label: string; href: string }[] }[] = [
    {
      head: "Recall",
      links: [
        { label: "The recall query", href: "/#notice" },
        { label: "Findings → upgrades", href: "/#collapse" },
        { label: "How it holds up", href: "/#how" },
        { label: "Why a graph", href: "/#graph" },
        { label: "What it does not claim", href: "/limits" },
      ],
    },
    {
      head: "Use it",
      links: [
        { label: "Open the tool", href: "/app/" },
        { label: "Source on GitHub", href: "https://github.com/jadonamite/recall" },
        { label: "MIT licence", href: "https://github.com/jadonamite/recall/blob/main/LICENSE" },
      ],
    },
    {
      head: "Data",
      links: [
        { label: "OSV advisories", href: "https://osv.dev" },
        { label: "deps.dev resolution", href: "https://deps.dev" },
        { label: "HydraDB", href: "https://hydradb.com" },
      ],
    },
  ];

  return (
    <footer className="mt-32 border-t border-white/[0.07] pt-14 pb-16">
      <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <RecallMark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fog">
            The product-recall query for software supply chains. Reverse
            dependency traversal on HydraDB, over {num(site.graph.packages)}{" "}
            packages of public graph.
          </p>
          <div className="mt-6 flex items-center gap-3 text-fog">
            <a
              href="https://github.com/jadonamite/recall"
              target="_blank"
              rel="noreferrer"
              aria-label="Source on GitHub"
              className="transition-colors hover:text-ice"
            >
              <Brand name="github" />
            </a>
            <a
              href="https://www.npmjs.com"
              target="_blank"
              rel="noreferrer"
              aria-label="npm"
              className="transition-colors hover:text-ice"
            >
              <Brand name="npm" />
            </a>
          </div>
        </div>

        {cols.map((c) => (
          <div key={c.head}>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.28em] text-fog">
              {c.head}
            </h4>
            <ul className="mt-5 space-y-3">
              {c.links.map((l) => {
                // Anything not an in-page hash is a real document request:
                // /app is outside the Next route tree.
                const ext = !l.href.startsWith("#");
                return (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="group inline-flex items-center gap-1.5 text-sm text-ice/70 transition-colors hover:text-ice"
                    >
                      {l.label}
                      {ext && (
                        <IconArrow className="h-3.5 w-3.5 -rotate-45 opacity-0 transition-opacity group-hover:opacity-60" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.05] pt-6 font-mono text-[11px] text-fog">
        <span>MIT · © 2026</span>
        <span>
          graph read {site.builtAt} · {num(site.graph.edges)} edges ·{" "}
          {site.graph.publicApps} public applications
        </span>
      </div>
    </footer>
  );
}
