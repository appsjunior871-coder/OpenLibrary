import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM packages must not be bundled by the server compiler.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pdfjs-dist"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
