const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "nmykwpztvijkcuwmpmyw.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
