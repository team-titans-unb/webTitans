/** @type {import('next').NextConfig} */
const nextConfig = {
  // hot reload
  output: "standalone",
  reactStrictMode: true,
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
