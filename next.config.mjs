/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera um build "standalone" enxuto, ideal para a imagem Docker.
  output: "standalone",
  reactStrictMode: true,
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
