// src/lib/prisma.ts
// Uygulamanın her yerinde kullanılacak tek veritabanı bağlantısı
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

// Next.js geliştirme modunda her kayıtta yeni bağlantı açılmasını engeller
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;