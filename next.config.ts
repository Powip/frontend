import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // Aquí es donde defines los dominios externos permitidos
    domains: ["res.cloudinary.com"],
  },
};

export default nextConfig;
