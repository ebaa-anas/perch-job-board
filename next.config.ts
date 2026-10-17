import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const nextConfig: NextConfig = {
  // Hides the floating dev-tools badge. It only ever renders under
  // `next dev` and never in a production build, so this is purely for a
  // clean local screen; compile and runtime errors are still surfaced.
  devIndicators: false,

  images: {
    remotePatterns: supabaseHost
      ? [
          { protocol: "https", hostname: supabaseHost },
          { protocol: "http", hostname: "127.0.0.1" },
        ]
      : [],
    // Company logos may be SVG. Optimize them but neutralise script content.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Baseline response hardening for every route. Deliberately not a full
  // Content-Security-Policy: the pre-paint theme script in app/layout.tsx is
  // inline, so a script-src policy would need per-request nonces threaded
  // through the document — worth doing, but not something to switch on without
  // testing every page. `frame-ancestors` is safe to set on its own because it
  // governs who may embed us, not what we may load.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Pin browsers to HTTPS for a year, subdomains included.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Never let a sniffed MIME type override the declared one — matters
          // most for the CV and logo downloads we hand out as signed URLs.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Clickjacking: `frame-ancestors` is the modern control, and
          // X-Frame-Options stays for browsers that predate it.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // Send the full URL within our own origin, bare origin elsewhere, so
          // a job slug never leaks into a third party's referer log.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing in Perch uses these, so deny them outright.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
