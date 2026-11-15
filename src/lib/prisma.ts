// src/lib/prisma.ts
// Uygulamanın her yerinde kullanılacak tek veritabanı bağlantısı.
// Uygulamada takım ve turnuva adları okunurken Türkçeye çevrilir (bkz. lib/team-names.ts): "Latvia" → "Letonya".
// Veritabanındaki kayıt değişmez; senkron scriptleri (scripts/) adları çevrilmeden, BSD'den geldiği gibi okur.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { trLeague, trTeam } from "./team-names";

function createClient() {
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const localized = base.$extends({
    result: {
      team: {
        name: { needs: { name: true }, compute: (t) => trTeam(t.name) },
      },
      league: {
        name: { needs: { name: true }, compute: (l) => trLeague(l.name) },
      },
    },
  });
  // Senkron scriptleri okuduğu adı başka tablolara yazar (kariyer satırları); çeviri oraya sızmasın
  const isScript = /[\\/]scripts[\\/]/.test(process.argv[1] ?? "");
  return isScript ? (base as unknown as typeof localized) : localized;
}

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prismaLocalized?: Client };

export const prisma: Client = globalForPrisma.prismaLocalized ?? createClient();

// Next.js geliştirme modunda her kayıtta yeni bağlantı açılmasını engeller
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaLocalized = prisma;
