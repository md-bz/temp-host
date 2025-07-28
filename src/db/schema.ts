// drizzle/schema.ts

import { sqliteTable } from "drizzle-orm/sqlite-core";
import * as t from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Files table
export const files = sqliteTable("files", {
    id: t.int().primaryKey({ autoIncrement: true }),
    filename: t.text("filename").notNull(),
    size: t.integer("size").notNull(), // in bytes
    storagePath: t.text("storage_path").notNull(),
    uploadedAt: t
        .integer("uploaded_at")
        .notNull()
        .default(sql`(strftime('%s','now'))`), // UNIX timestamp
    expiresAt: t.integer("expires_at").notNull(), // UNIX timestamp
    downloadCount: t.integer("download_count").notNull().default(0),
    maxDownloadCount: t.integer("max_download_count").notNull().default(10000),
    password: t.text("password"),
    url: t.text("url").notNull(),
});

export const users = t.sqliteTable("users", {
    id: t.int().primaryKey({ autoIncrement: true }),
    name: t.text("name").notNull(),
    email: t.text("email").notNull().unique(),
    password: t.text("password").notNull(),
    createdAt: t.integer("created_at").default(sql`(strftime('%s','now'))`),
});

export const captchas = t.sqliteTable("captchas", {
    id: t.text("id").primaryKey(),
    text: t.text("text").notNull(),
    expiry: t.integer("expiry").notNull(),
});
