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
    userId: t.integer("user_id").references(() => users.id),
});

export const texts = sqliteTable("texts", {
    id: t.int().primaryKey({ autoIncrement: true }),
    content: t.text("content").notNull(),
    url: t.text("url").notNull().unique(),
    createdAt: t
        .integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now'))`),
    expiresAt: t.integer("expires_at").notNull(),
    userId: t.integer("user_id").references(() => users.id),
});

export const users = t.sqliteTable("users", {
    id: t.int().primaryKey({ autoIncrement: true }),
    name: t.text("name").notNull(),
    email: t.text("email").notNull().unique(),
    password: t.text("password").notNull(),
    createdAt: t.integer("created_at").default(sql`(strftime('%s','now'))`),
    role: t.text("role").notNull().default("user"),
    blockedAt: t.integer("blocked_at"), // UNIX timestamp, null = not blocked
});

// One-time signup codes
export const invites = t.sqliteTable("invites", {
    id: t.int().primaryKey({ autoIncrement: true }),
    code: t.text("code").notNull().unique(),
    createdAt: t
        .integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now'))`),
    usedAt: t.integer("used_at"), // UNIX timestamp, null = unused
    usedBy: t.integer("used_by").references(() => users.id),
});

export const settings = t.sqliteTable("settings", {
    id: t.int().primaryKey({ autoIncrement: true }),
    key: t.text("key").notNull().unique(),
    value: t.text("value").notNull(),
});
