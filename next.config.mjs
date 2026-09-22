/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Emits .next/standalone — the app plus only the node_modules it actually
     uses, with its own server.js. Lets a host run the app without an install
     or a build step, which shared hosting rarely has the memory for.
     Vercel ignores this and builds its own output. */
  output: 'standalone',
};

export default nextConfig;
