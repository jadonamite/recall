import type { NextConfig } from "next";

// Static export: the page is measured data plus markup, so there is nothing for
// a server to do at request time. It deploys as plain files.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
