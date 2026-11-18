import * as fs from "fs/promises";
import * as argon2 from "argon2";
import { nanoid } from "nanoid";
import { sign, verify } from "hono/jwt";
import { db } from "./db/db";
import { files, settings, texts, users } from "./db/schema";
import { join } from "path";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { eq, sql } from "drizzle-orm";

export function toUnixDate(
    input?: string | number,
    defaultTime: number = 0,
): number {
    if (typeof input === "number") {
        return input;
    }
    if (!input) return defaultTime;

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

    if (unit === "s") {
        return value * 1000;
    }

    return defaultTime;
}

const maxAge = toUnixDate(process.env.MAX_AGE || "1d");

const maxDownloadCount = process.env.MAX_DOWNLOAD_COUNT
    ? Number(process.env.MAX_DOWNLOAD_COUNT)
    : 10000;

const maxFileSizeBytes = process.env.MAX_FILE_SIZE
    ? Number(process.env.MAX_FILE_SIZE) * 1024 * 1024
    : Infinity;

export const defaultStorageQuota = process.env.DEFAULT_STORAGE_QUOTA
    ? Number(process.env.DEFAULT_STORAGE_QUOTA) * 1024 * 1024
    : Infinity;

export const formatSize = (bytes: number) =>
    bytes === 0
        ? "0 B"
        : bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(1)} KB`
          : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export class HttpError extends Error {
    status: ContentfulStatusCode;

    constructor(message: string, status: ContentfulStatusCode) {
        super(message);
        this.status = status;
    }
}

export async function storageUsed(userId: number) {
    return Number(
        (
            await db
                .select({ n: sql<number>`coalesce(sum(${files.size}), 0)` })
                .from(files)
                .where(eq(files.userId, userId))
        ).at(0)?.n ?? 0,
    );
}

export async function saveFile(
    body: { [key: string]: string | File },
    userId?: number,
) {
    const file = body["file"] as File;
    const downloadCount = body["downloadCount"] as string;
    const age = body["age"] as string;

    if (!file) {
        throw new HttpError("no file sent", 400);
    }

    if (file.size > maxFileSizeBytes) {
        throw new HttpError("file too large", 413);
    }

    if (userId) {
        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .get();
        const quota = user?.storageQuota ?? defaultStorageQuota;
        const used = await storageUsed(userId);

        // shortcut: concurrent uploads can both pass this check, fine for one instance
        if (used + file.size > quota) {
            throw new HttpError(
                `storage quota exceeded (${formatSize(used)} of ${formatSize(quota)} used)`,
                413,
            );
        }
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
    const rawPassword = body["password"];
    const password =
        typeof rawPassword === "string" && rawPassword.length > 0
            ? await argon2.hash(rawPassword)
            : null;

    await db.insert(files).values({
        filename: file.name,
        size: file.size,
        expiresAt: Date.now() + Math.min(maxAge, toUnixDate(age, Infinity)),
        maxDownloadCount: Math.min(
            maxDownloadCount,
            downloadCount ? Number(downloadCount) : Infinity,
        ),
        url,
        storagePath: storagePath,
        userId,
        password,
    });

    return url;
}
export async function getFileInfo(id: string) {
    const file = await db.select().from(files).where(eq(files.url, id)).get();

    if (
        !file ||
        file.expiresAt < Date.now() ||
        file.downloadCount >= file.maxDownloadCount
    ) {
        throw new HttpError("file not found or expired", 404);
    }
    return file;
}

// lets a visitor download one password-protected file for an hour
export async function fileAccessToken(url: string) {
    return await sign(
        { file: url, exp: Math.floor(Date.now() / 1000) + 60 * 60 },
        process.env.JWT_SECRET!,
    );
}

export async function canAccessFile(
    file: { url: string; password: string | null },
    accessToken?: string,
) {
    if (!file.password) return true;
    if (!accessToken) return false;

    try {
        const payload = await verify(accessToken, process.env.JWT_SECRET!);
        return payload.file === file.url && !!payload.exp;
    } catch {
        return false;
    }
}

export async function getFile(id: string, accessToken?: string) {
    const file = await getFileInfo(id);

    if (!(await canAccessFile(file, accessToken))) {
        throw new HttpError("password required", 401);
    }

    let data;
    try {
        data = await fs.readFile(file.storagePath);
    } catch (error) {
        console.log(error);
        throw new HttpError("something went wrong", 500);
    }

    await db
        .update(files)
        .set({ downloadCount: file.downloadCount + 1 })
        .where(eq(files.id, file.id));

    return { data, ...file };
}

export async function saveText(
    body: { [key: string]: string | File },
    userId?: number,
) {
    const content = body["content"] as string;
    const age = body["age"] as string;

    if (!content) {
        throw new HttpError("no content sent", 400);
    }

    const url = nanoid();
    const rawPassword = body["password"];
    const password =
        typeof rawPassword === "string" && rawPassword.length > 0
            ? await argon2.hash(rawPassword)
            : null;

    await db.insert(texts).values({
        content,
        expiresAt: Date.now() + Math.min(maxAge, toUnixDate(age, Infinity)),
        url,
        userId,
        password,
    });

    return url;
}

export async function getText(id: string) {
    const text = await db.select().from(texts).where(eq(texts.url, id)).get();

    if (!text || text.expiresAt < Date.now()) {
        throw new HttpError("text not found or expired", 404);
    }

    return text;
}

export async function signupsRestricted() {
    const row = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "signupRestricted"))
        .get();

    return row?.value === "true";
}

export async function setSignupsRestricted(restricted: boolean) {
    const value = String(restricted);

    await db
        .insert(settings)
        .values({ key: "signupRestricted", value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
}
