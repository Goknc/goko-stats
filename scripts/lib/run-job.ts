// scripts/lib/run-job.ts
// Her senkron görevini sync_runs tablosuna kaydeder: süre, istek sayısı, hata.
import { prisma } from "../../src/lib/prisma";
import { getRequestCount } from "../../src/lib/bsd/client";

export async function runJob(job: string, task: () => Promise<void>) {
  const run = await prisma.syncRun.create({ data: { job } });
  const started = Date.now();
  try {
    await task();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), requestsUsed: getRequestCount() },
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`✔ ${job} bitti: ${getRequestCount()} istek, ${seconds} sn`);
  } catch (e) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        requestsUsed: getRequestCount(),
        error: e instanceof Error ? e.message : String(e),
      },
    });
    console.error(`✖ ${job} hata verdi:`, e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}