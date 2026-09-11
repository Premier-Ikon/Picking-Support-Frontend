/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["html5-qrcode"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
};

module.exports = nextConfig;
