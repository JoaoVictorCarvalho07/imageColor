/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["sharp", "archiver", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/admin/ensaios/[id]/upload": [
      "./node_modules/ffmpeg-static/**/*",
      "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/**/*",
    ],
  },
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
