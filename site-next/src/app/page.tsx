import Link from "next/link";
import { Panel, Reveal, SectionLabel } from "@/components/ui";
import { Nav, Footer } from "@/components/Chrome";
import RecallNotice from "@/components/RecallNotice";
import WallOrRecall from "@/components/WallOrRecall";
import Blocks from "@/components/Blocks";
import BuiltOn from "@/components/BuiltOn";
import { IconArrow, IconShield, IconTerminal } from "@/components/icons";
import { site, num } from "@/lib/data";

// Spacing is deliberately uneven. The thesis and the recall notice get the most
// air because they carry the argument; the proof band is tight and dense so it
// reads as instrumentation rather than as another content section.

function Sources() {
  const s = site.publicSources;
  return (
    <>
      {s.map((x, i) => (
        <span key={x.name}>
          {i > 0 && (i === s.length - 1 ? " and " : ", ")}
          <a
            href={x.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-act-soft hover:text-ice"
          >
            {x.name}
          </a>
        </span>
      ))}
    </>
  );
}

export default function Home() {
  const c = site.consumer;

  return (
    <main className="mx-auto w-full max-w-md px-6 sm:max-w-2xl lg:max-w-6xl lg:px-10">
      <Nav />

      {/* Hero */}
      <section className="pt-16 pb-4 lg:pt-24">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-act">
            The product-recall query for software
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-7 max-w-[19ch] text-5xl font-extrabold leading-[0.98] tracking-[-0.042em] lg:text-[5.2rem]">
            Toyota has run this query
            <span className="text-fog"> since the 1970s.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ice/65">
            When a bad component lot turns up, a manufacturer runs the bill of
            materials <span className="text-ice">upward</span>
            {" — "}which sub-assemblies used it, which finished products used
            those, which owners to write to. Software borrowed the phrase &ldquo;bill of
            materials&rdquo; and never implemented the query that makes one
            useful.
          </p>
        </Reveal>
        <Reveal delay={0.18} className="mt-9">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="#notice"
              className="inline-flex items-center gap-2 rounded-full bg-act px-5 py-3 text-sm font-bold text-ice transition-colors hover:bg-act-soft hover:text-mid"
            >
              See the query <IconArrow className="h-4 w-4" />
            </Link>
            <a
              href="/app/"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-ice ring-1 ring-inset ring-white/15 transition-colors hover:ring-white/30"
            >
              <IconTerminal className="h-4 w-4" /> Open the tool
            </a>
          </div>
        </Reveal>
      </section>

      {/* Proof band — tight, no card chrome */}
      <Reveal delay={0.24}>
        <section className="mt-16 grid grid-cols-2 border-y border-white/[0.07] lg:grid-cols-5">
          {[
            ["packages", num(site.graph.packages)],
            ["dependency edges", num(site.graph.edges)],
            ["advisory windows", num(site.graph.advisoryWindows)],
            ["exposed with reach", num(site.graph.exposedWithReach)],
            ["store", "HydraDB"],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={
                i === 0
                  ? "py-5 pr-5"
                  : "border-t border-white/[0.05] py-5 pr-5 lg:border-t-0 lg:border-l lg:border-white/[0.05] lg:pl-5"
              }
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
                {k}
              </dt>
              <dd className="tnum mt-2 font-mono text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </section>
      </Reveal>

      {/* 01 — the trap */}
      {c && (
        <section id="collapse" className="pt-32 lg:pt-48">
          <Reveal>
            <SectionLabel index="01">What every scanner does</SectionLabel>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.03] tracking-[-0.035em] lg:text-[3.6rem]">
              A list tells you that you&rsquo;re bleeding.
              <span className="text-fog"> Not where the wound is.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ice/65">
              Run <code className="font-mono text-ice">npm audit</code> on
              anything real and you get hundreds of findings, unordered, naming
              packages you never installed on purpose. You cannot tell which
              single upgrade kills thirty of them, because{" "}
              <span className="text-ice">a list has already thrown away the path.</span>{" "}
              So people stop reading it. That is alert fatigue, and it is the
              defining failure of this whole category of tool.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="mt-12">
            <WallOrRecall data={c} />
          </Reveal>
        </section>
      )}

      {/* 02 — the recall notice */}
      <section id="notice" className="pt-32 lg:pt-48">
        <Reveal>
          <SectionLabel index="02">The query no scanner can answer</SectionLabel>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.03] tracking-[-0.035em] lg:text-[3.6rem]">
            Your package was just compromised.
            <span className="text-fog"> Who do you have to write to?</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ice/65">
            A scanner starts from <em>your</em>{" "}manifest, so it can only answer
            the consumer&rsquo;s question. The maintainer&rsquo;s question runs
            the other way, and it is the one an actual product recall asks:{" "}
            <span className="text-ice">
              who shipped my part, by what chain, and which single upgrade closes
              the most of it.
            </span>
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-fog">
            Every figure below is measured, not illustrative. The dependents are
            real published packages and real public applications: ~150 seed
            packages plus the committed lock files of <Sources />.
          </p>
        </Reveal>
        <Reveal delay={0.2} className="mt-12">
          <RecallNotice notices={site.notices} />
        </Reveal>
      </section>

      {/* 03 — how it works, as blocks */}
      <section id="how" className="pt-32 lg:pt-48">
        <Reveal>
          <SectionLabel index="03">How it holds up</SectionLabel>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mt-7 max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.035em] lg:text-[3.6rem]">
            Four things a flat scan
            <span className="text-fog"> cannot do.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12} className="mt-12">
          <Blocks />
        </Reveal>
      </section>

      {/* 04 — why a graph */}
      <section id="graph" className="pt-32 lg:pt-48">
        <Reveal>
          <SectionLabel index="04">Why this is not a table</SectionLabel>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mt-7 max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.035em] lg:text-[3.6rem]">
            &ldquo;Reaches&rdquo;
            <span className="text-fog"> is not a distance.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ice/65">
            Every question above is a path query. A relational schema answers
            them with recursive CTEs that fall over at depth; a vector store
            cannot express them at all, because similarity is not reachability —{" "}
            <span className="text-ice">
              the compromised package is not <em>like</em> your app, it is inside it.
            </span>
          </p>
        </Reveal>
        <Reveal delay={0.16} className="mt-10">
          <Panel className="p-7 lg:p-9">
            <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed text-fog">
              {site.query.split("relDirection: 'incoming'").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="font-bold text-act-soft">
                      relDirection: &apos;incoming&apos;
                    </span>
                  )}
                </span>
              ))}
            </pre>
          </Panel>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-fog">
            HydraDB rejects reverse variable-length patterns, so the traversal
            runs as a native procedure. That one parameter is the entire
            difference between a scanner and a recall.
          </p>
        </Reveal>
      </section>

      {/* 05 — the limits */}
      <section id="limits" className="pt-32 lg:pt-48">
        <Reveal>
          <SectionLabel index="05">Before you believe any of it</SectionLabel>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mt-7 max-w-2xl text-4xl font-extrabold leading-[1.03] tracking-[-0.035em] lg:text-[3.6rem]">
            The limits,
            <span className="text-fog"> stated first.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12} className="mt-10">
          <Panel className="p-7 lg:p-10">
            <IconShield className="h-6 w-6 text-act" />
            <ul className="mt-6 divide-y divide-white/[0.06]">
              {[
                [
                  "It does not claim reachability.",
                  "Recall proves a vulnerable version is in your tree and shows the chain. It does not claim the vulnerable function is ever called. That is a much harder problem, and blurring the two is how this category lost its credibility.",
                ],
                [
                  "The shared graph is a judgement call, not a mirror of npm.",
                  `It is ~150 high-traffic seed packages with their resolved trees, plus ${site.graph.publicApps} public applications' lock files. Scanning your own project is unaffected, and your tree never joins this graph.`,
                ],
                [
                  "An upgrade is not always available.",
                  "Sometimes the real fix is an overrides entry, and sometimes upstream has not shipped one at all. Recall tells you where the path enters; it does not promise the door opens.",
                ],
                [
                  "CVSS v4 vectors are reported unrated.",
                  "The v4 score is a lookup table, not a closed form. Running the v3 equation over a v4 vector produces a confident number that is simply wrong.",
                ],
              ].map(([head, body]) => (
                <li key={head} className="py-4 first:pt-0 last:pb-0">
                  <span className="text-[15px] font-semibold text-ice">{head}</span>{" "}
                  <span className="text-[15px] leading-relaxed text-fog">{body}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>

      <BuiltOn />

      {/* Close */}
      <Reveal className="mt-32 lg:mt-44">
        <Panel glow className="px-8 py-16 text-center lg:px-16 lg:py-24">
          <h2 className="mx-auto max-w-[24ch] text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] lg:text-6xl">
            Software has a bill of materials.
            <span className="text-fog"> Now it has the query.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-ice/65">
            Open source, MIT, and the crawled graph ships with the repo — so it
            runs in one step instead of after an afternoon of crawling.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a
              href="/app/"
              className="inline-flex items-center gap-2 rounded-full bg-act px-6 py-3 text-sm font-bold text-ice transition-colors hover:bg-act-soft hover:text-mid"
            >
              <IconTerminal className="h-4 w-4" /> Open the tool
            </a>
            <a
              href="https://github.com/jadonamite/recall"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-ice ring-1 ring-inset ring-white/15 transition-colors hover:ring-white/30"
            >
              Read the source <IconArrow className="h-4 w-4 -rotate-45" />
            </a>
          </div>
          <div className="mx-auto mt-9 max-w-md overflow-x-auto rounded-2xl bg-mid/70 p-4 text-left ring-1 ring-inset ring-white/[0.06]">
            <pre className="font-mono text-[12px] leading-relaxed text-fog">
              git clone github.com/jadonamite/recall{"\n"}
              npm install &amp;&amp; npm run load{"\n"}
              <span className="text-act-soft">npm run recall ~/code/your-app</span>
            </pre>
          </div>
        </Panel>
      </Reveal>

      <Footer />
    </main>
  );
}
