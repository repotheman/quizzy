/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["10.60.0.17"],
  // Performance optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["@neondatabase/serverless"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-icons",
    ],
  },
}

export default nextConfig
