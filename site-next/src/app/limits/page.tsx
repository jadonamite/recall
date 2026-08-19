import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { Panel, Reveal, SectionLabel } from "@/components/ui";
import { IconArrow, IconShield } from "@/components/icons";
import { site, num } from "@/lib/data";

export const metadata: Metadata = {
  title: "Recall — what it does not claim",
  description:
    "The limits of the recall query, stated plainly: presence and chain, not runtime reachability; a seeded graph rather than a mirror of npm; upgrades that may not exist; CVSS v4 left unrated.",
};

/**
 * The limits, on their own page.
 *
 * They used to sit inline on the landing page, which put the honest caveats in
 * the same breath as the claim and made both harder to read. On their own page
 * they are easier to find deliberately and no weaker for being one click away —
 * the landing page still links here by name rather than burying it.
 */

const LIMITS: { head: string; body: string }[] = [
  {
    head: "It proves the part is in the car. Not that anyone turned it on.",
    body: "Recall shows a vulnerable version is in your tree and the exact chain that put it there. It does not claim the vulnerable function is ever called on any path your code takes. True reachability analysis is a research problem, and a heuristic presented as analysis is how this whole category of tool lost its credibility — so the claim stops where the evidence does.",
  },
  {
    head: "The shared graph is a judgement call, not a mirror of npm.",
    body: `It is ~${num(site.graph.seedPackages)} high-traffic seed packages with their resolved trees, plus ${site.graph.publicApps} public applications' committed lock files — ${num(site.graph.packages)} packages and ${num(site.graph.edges)} dependency links in total. That is a deliberate sample chosen to make the ecosystem questions answerable, not a claim to completeness. Scanning your own project is unaffected: your tree is resolved from your own lock file, and it never joins this graph.`,
  },
  {
    head: "Sometimes there is no upgrade to make.",
    body: "Recall ranks the direct dependencies your findings enter through, because those are the only things you can change. It cannot promise the change is available: the real fix is sometimes an overrides entry, and sometimes upstream has not shipped a patched release at all. It tells you where the path enters. It does not promise the door opens.",
  },
  {
    head: "CVSS v4 vectors are reported unrated.",
    body: "OSV records severity inconsistently — sometimes a label, sometimes a vector, frequently both a v3 and a v4 vector on the same advisory. Recall computes the CVSS v3.x base score from the vector using the published formula, tested against the specification's own worked examples. The v4 score is a lookup table rather than a closed form, so running the v3 equation over a v4 vector would produce a confident number that is simply wrong. Those report as UNRATED instead.",
  },
  {
    head: "The hosted demo is a recorded scan, and says so on its face.",
    body: "Recall cannot run on a serverless host: the traversal needs a Bolt connection to a HydraDB node, resolution reads a lock file off disk, and a first scan of an unseen project queries OSV for hundreds of package names. The published page is the real interface rendering a real scan of jitsi/jitsi-meet, computed locally and shipped with the page. Nothing in it is trimmed or invented, and anyone can re-run it.",
  },
];

export default function LimitsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 lg:px-10">
      <Nav />

      <section className="pt-14 pb-4 lg:pt-20">
        <Reveal>
          <SectionLabel index="—">Before you believe any of it</SectionLabel>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="display display-lg mt-8 max-w-[16ch]">
            The limits,
            <span className="text-fog"> stated first.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="lede mt-7 max-w-2xl text-ice/70">
            A tool that only tells you what it is good at is asking you to find
            the rest out yourself. Everything Recall cannot do is here, in the
            same words it would use if a reviewer asked.
          </p>
        </Reveal>
      </section>

      <Reveal delay={0.16} className="mt-10">
        <Panel className="p-7 lg:p-10">
          <IconShield className="h-6 w-6 text-act" />
          <ul className="mt-6 divide-y divide-white/[0.06]">
            {LIMITS.map((l) => (
              <li key={l.head} className="py-6 first:pt-0 last:pb-0">
                <h2 className="text-[17px] font-semibold text-ice">{l.head}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-fog">
                  {l.body}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>

      <Reveal delay={0.2} className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-ice ring-1 ring-white/15 ring-inset transition-colors hover:ring-white/30"
        >
          <IconArrow className="h-4 w-4 rotate-180" /> Back to the recall
        </Link>
      </Reveal>

      <Footer />
    </main>
  );
}
