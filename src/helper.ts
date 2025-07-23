import * as fs from "fs/promises";
import { nanoid } from "nanoid";
import { db } from "./db/db";
import { files } from "./db/schema";
import { join } from "path";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { eq } from "drizzle-orm";

export function toUnixDate(
    input: string | number,
    defaultTime: number = 0
): number {
    if (typeof input === "number") {
        return input;
    }

    if (/^\d+$/.test(input)) {
        return parseInt(input, 10);
    }

    const unit = input.slice(-1);
    const numPart = input.slice(0, -1);
    const value = parseInt(numPart, 10);

    if (isNaN(value)) {
        return defaultTime;
    }

    if (unit === "h") {
        return value * 60 * 60 * 1000;
    }

    if (unit === "d") {
        return value * 24 * 60 * 60 * 1000;
    }

    if (unit === "m") {
        return value * 60 * 1000;
    }

    return defaultTime;
}

const maxAge = toUnixDate(process.env.MAX_AGE || "1d");

export class HttpError extends Error {
    status: ContentfulStatusCode;

    constructor(message: string, status: ContentfulStatusCode) {
        super(message);
        this.status = status;
    }
}

export async function saveFile(body: { [key: string]: string | File }) {
    const file = body["file"] as File;
    const age = body["age"] as string;

    if (!file) {
        throw new HttpError("no file sent", 400);
    }

    const data = await file.bytes();
    const storagePath = join("./", "files", file.name + Date.now());
    try {
        await fs.writeFile(storagePath, data);
    } catch (err) {
        console.error(err);
        throw new HttpError("something went wrong", 500);
    }

    const url = nanoid();

    await db.insert(files).values({
        filename: file.name,
        size: file.size,
        expiresAt: Date.now() + Math.min(maxAge, toUnixDate(age, Infinity)),
        url,
        storagePath: storagePath,
    });

    return url;
}

export async function getFile(id: string) {
    const file = await db.select().from(files).where(eq(files.url, id)).get();

    if (!file || file.expiresAt < Date.now()) {
        throw new HttpError("file not found", 404);
    }

    let data;
    try {
        data = await fs.readFile(file.storagePath);
    } catch (error) {
        console.log(error);
        throw new HttpError("something went wrong", 500);
    }

    return { data, filename: file.filename };
}
