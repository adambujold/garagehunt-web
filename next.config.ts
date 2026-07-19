import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Listing photos are served from Supabase Storage's public URL —
    // same project the mobile app uses.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "musrnxyygnqzbbpkuqip.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
