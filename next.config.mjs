/** @type {import('next').NextConfig} */
const nextConfig = {
  // THIS IS THE LIFESAVER FOR HACKATHONS
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;