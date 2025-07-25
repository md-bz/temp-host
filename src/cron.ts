import { CronJob } from "cron";
import { db } from "./db/db";
import { files } from "./db/schema";
import { gte, lte, or } from "drizzle-orm";
import * as fs from "fs/promises";

const job = new CronJob(
    "0 0 5 * * *", // 5:00:00 am
    async function () {
        const cleaned = await db
            .delete(files)
            .where(
                or(
                    lte(files.expiresAt, Date.now()),
                    gte(files.downloadCount, files.maxDownloadCount)
                )
            )
            .returning();

        const results = await Promise.allSettled(
            cleaned.map((c) => fs.unlink(c.storagePath))
        );

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                console.error(
                    `Failed to delete ${cleaned[index].storagePath}`,
                    result.reason
                );
            }
        });

        console.info(
            `cleaned database ${JSON.stringify(
                cleaned.map((c) => ({
                    id: c.id,
                    expiresAt: c.expiresAt,
                    downloadCount: c.downloadCount,
                    maxDownloadCount: c.maxDownloadCount,
                    url: c.url,
                }))
            )}`
        );
    },
    null, // onComplete
    true // start
);
