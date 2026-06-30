/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp usa binário nativo — não deve ser empacotado pelo bundler.
  serverExternalPackages: ["sharp", "archiver", "ffmpeg-static"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-1375a85e55314097a7d3216cef125313.r2.dev",
      },
    ],
  },
};

export default nextConfig;
