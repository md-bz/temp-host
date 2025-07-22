import { Hono } from "hono";
import * as fs from "fs/promises";
import { join } from "path";
import { db } from "./db/db";
import { files } from "./db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { toUnixDate } from "./helper";

export const api = new Hono();

const maxAge = toUnixDate(process.env.MAX_AGE || "1d");

api.post("/file", async (c) => {
    const body = await c.req.parseBody();

    const file = body["file"] as File;
    const age = body["age"] as string;

    if (!file) {
        c.json({ error: "no file sent" }, 400);
    }

    const data = await file.bytes();
    const storagePath = join("./", "files", file.name + Date.now());
    try {
        await fs.writeFile(storagePath, data);
    } catch (err) {
        console.error(err);
        return c.json({ error: "something went wrong" }, 500);
    }

    const url = nanoid();

    await db.insert(files).values({
        filename: file.name,
        size: file.size,
        expiresAt: Date.now() + Math.min(maxAge, toUnixDate(age, Infinity)),
        url,
        storagePath: storagePath,
    });

    return c.json({ url });
});

api.get("/file/:id", async (c) => {
    const id = c.req.param("id");
    const file = await db.select().from(files).where(eq(files.url, id)).get();

    if (!file || file.expiresAt < Date.now()) {
        return c.json({ error: "file not found" }, 404);
    }

    let data;
    try {
        data = await fs.readFile(file.storagePath);
    } catch (error) {
        return c.json({ error: "something went wrong" }, 500);
    }

    return c.body(data, 200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
    });
});
