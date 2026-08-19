import type { NextConfig } from "next";

// Static export: the page is measured data plus markup, so there is nothing for
// a server to do at request time. It deploys as plain files.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // The build is deployed as a bare directory of files, with no framework
  // routing in front of it, so /limits only resolves if the export writes
  // limits/index.html rather than limits.html. This is also how /app already
  // works, so the two agree.
  trailingSlash: true,
};

export default nextConfig;
