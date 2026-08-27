import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El cliente Prisma generado es un paquete externo del server runtime.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
