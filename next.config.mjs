/** @type {import('next').NextConfig} */

/* Response headers the app was not sending at all. Vercel adds HSTS; these
   are the rest, and they cost nothing to serve.

   `frame-ancestors` is the one that matters here. Without it any site can
   load this one in an iframe, cover it with its own page, and collect clicks
   that land on whatever is underneath — and what is underneath includes the
   admin console's edit and payment buttons. X-Frame-Options says the same
   thing for older browsers that ignore CSP.

   Note this CSP carries `frame-ancestors` only. A full CSP would also have to
   allow the inline scripts Next.js injects, which needs per-request nonces —
   worth doing, but as its own change rather than smuggled in here. */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },

  // Stops a browser from second-guessing a declared Content-Type, which is
  // how a file served as text can end up executed as a script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // The Discord callback puts the user's id and name in the URL. This keeps
  // that URL from travelling to other origins in a Referer header.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Nothing here uses these, so no page can be tricked into asking for them.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  /* Emits .next/standalone — the app plus only the node_modules it actually
     uses, with its own server.js. Lets a host run the app without an install
     or a build step, which shared hosting rarely has the memory for.
     Vercel ignores this and builds its own output. */
  output: 'standalone',

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
