import raw from "../../public/site.json";

/**
 * The page's dataset. Every figure here was measured by src/build-site.js
 * against a live HydraDB traversal — nothing on the page is authored, and the
 * types exist so a change in the build's shape breaks the build rather than
 * quietly rendering `undefined` at someone.
 */

export type Advisory = {
  osv: string;
  summary: string;
  label: string;
  score: number | null;
  rank: number;
};

export type Notice = {
  package: string;
  name: string;
  version: string;
  worst: Advisory;
  advisories: Advisory[];
  dependents: number;
  paths: number;
  maxDepth: number;
  byDepth: [number, number][];
  cuts: { package: string; severs: number; dependents: number }[];
  notify: string[];
  chains: string[][];
};

export type Consumer = {
  root: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  packages: number;
  edges: number;
  findings: number;
  fixCount: number;
  severities: Record<string, number>;
  fixes: {
    package: string;
    vulns: number;
    paths: number;
    label: string;
    score: number | null;
    via: string[];
  }[];
  details: {
    key: string;
    worst: Advisory;
    pathCount: number;
    chain: string[];
  }[];
  wall: [string, string, string, string][];
};

export type SiteData = {
  builtAt: string;
  graph: {
    packages: number;
    edges: number;
    seedPackages: number;
    publicApps: number;
    advisoryWindows: number;
    advisoryNames: number;
    vulnerableVersions: number;
    exposedWithReach: number;
    traversalSeconds: number;
  };
  publicSources: { name: string; url: string | null }[];
  query: string;
  projectQuery: string;
  notices: Notice[];
  consumer: Consumer | null;
};

export const site = raw as unknown as SiteData;

export const num = (n: number) => n.toLocaleString("en-US");
