// Los bloqueadores de anuncios cortan todo script cuya ruta contenga «publicidad»:
// la página quedaba en «Cargando...» o con ChunkLoadError. Solo cambia el nombre del
// archivo compilado; las URL que ve el usuario siguen igual.
const neutralChunkName = (name: string) => name.replace(/publicidad/g, "pbl");

const nextConfig = {
  webpack: (config: any, { isServer, dev }: { isServer: boolean; dev: boolean }) => {
    const template = config.output.filename;
    if (!isServer && !dev && typeof template === "string") {
      config.output.filename = ({ chunk }: { chunk?: { name?: string | null } }) =>
        template.replace("[name]", neutralChunkName(chunk?.name ?? "[name]"));
    }
    return config;
  },

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
