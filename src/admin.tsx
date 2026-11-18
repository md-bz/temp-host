import { Hono } from "hono";
import { count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db/db";
import { files, invites, texts, users } from "./db/schema";
import { adminAuth } from "./auth";
import {
    defaultStorageQuota,
    formatSize,
    setSignupsRestricted,
    signupsRestricted,
} from "./helper";
import { PAGE_SIZE, Pager, pageCount, pageParam } from "./pagination";

export const adminRouter = new Hono();

adminRouter.use("*", adminAuth);

adminRouter.get("/", async (c) => {
    const q = c.req.query("q")?.trim() || undefined;
    const filter = q
        ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`))
        : undefined;

    const total = Number(
        (await db.select({ n: count() }).from(users).where(filter)).at(0)?.n ??
            0
    );
    const pages = pageCount(total);
    const page = Math.min(pageParam(c, "page"), pages);

    const rows = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            blockedAt: users.blockedAt,
            uploads: sql<number>`cast(count(distinct ${files.id}) as integer)`,
            texts: sql<number>`cast(count(distinct ${texts.id}) as integer)`,
            used: sql<number>`cast((select coalesce(sum(size), 0) from files where files.user_id = users.id) as integer)`,
            storageQuota: users.storageQuota,
        })
        .from(users)
        .leftJoin(files, eq(files.userId, users.id))
        .leftJoin(texts, eq(texts.userId, users.id))
        .where(filter)
        .groupBy(users.id)
        .orderBy(desc(users.id))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE);

    const me = c.get("jwtPayload")?.id as number | undefined;
    const restricted = await signupsRestricted();
    const codes = restricted
        ? await db
              .select()
              .from(invites)
              .where(isNull(invites.usedAt))
              .orderBy(desc(invites.id))
        : [];

    return c.render(
        <>
            <article class="card wide">
                <h2>Users</h2>
                <form method="get" class="search">
                    <input
                        type="search"
                        name="q"
                        value={q}
                        placeholder="Search name or email"
                    />
                    <button type="submit" class="btn btn-sm">
                        Search
                    </button>
                    {q && (
                        <a href="/admin" class="btn btn-sm">
                            Clear
                        </a>
                    )}
                </form>
                <p>
                    <small>
                        Default storage quota:{" "}
                        {defaultStorageQuota === Infinity
                            ? "unlimited"
                            : formatSize(defaultStorageQuota)}{" "}
                        (DEFAULT_STORAGE_QUOTA). Leave a field empty to use
                        it.
                    </small>
                </p>
                {rows.length === 0 ? (
                    <p>No users match “{q}”.</p>
                ) : (
                <div style="overflow-x:auto">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Files</th>
                                <th>Texts</th>
                                <th>Storage</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((u) => (
                                <tr>
                                    <td data-label="Name">{u.name}</td>
                                    <td data-label="Email">{u.email}</td>
                                    <td data-label="Role">{u.role}</td>
                                    <td data-label="Files">{u.uploads}</td>
                                    <td data-label="Texts">{u.texts}</td>
                                    <td data-label="Storage">
                                        <small>
                                            {formatSize(u.used)} /{" "}
                                            {u.storageQuota
                                                ? formatSize(u.storageQuota)
                                                : "default"}
                                        </small>
                                        <form
                                            action={`/admin/quota/${u.id}`}
                                            method="post"
                                            class="quota"
                                        >
                                            <input
                                                type="hidden"
                                                name="back"
                                                value={new URL(c.req.url).search}
                                            />
                                            <input
                                                type="number"
                                                name="quota"
                                                min="1"
                                                step="1"
                                                value={
                                                    u.storageQuota
                                                        ? Math.round(
                                                              u.storageQuota /
                                                                  1024 /
                                                                  1024
                                                          )
                                                        : ""
                                                }
                                                placeholder="MB"
                                                aria-label="Storage quota in MB, empty uses the default"
                                            />
                                            <button
                                                type="submit"
                                                class="btn btn-sm"
                                            >
                                                Save
                                            </button>
                                        </form>
                                    </td>
                                    <td data-label="Status">
                                        {u.blockedAt ? "blocked" : "active"}
                                    </td>
                                    <td>
                                        {u.id !== me && (
                                            <form
                                                action={`/admin/block/${u.id}`}
                                                method="post"
                                            >
                                                <input
                                                    type="hidden"
                                                    name="back"
                                                    value={new URL(c.req.url).search}
                                                />
                                                <button
                                                    type="submit"
                                                    class="btn btn-sm"
                                                >
                                                    {u.blockedAt
                                                        ? "Unblock"
                                                        : "Block"}
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
                <Pager
                    url={c.req.url}
                    param="page"
                    page={page}
                    pages={pages}
                />
            </article>
            <article class="card wide">
                <h4>Signups</h4>
                <p>
                    Signups are{" "}
                    {restricted
                        ? "restricted to one-time invite codes"
                        : "open to everyone"}
                    .
                </p>
                <form action="/admin/signups" method="post">
                    <button type="submit" class="btn btn-sm">
                        {restricted ? "Allow open signups" : "Restrict signups"}
                    </button>
                </form>

                {restricted && (
                    <>
                        <form action="/admin/invites" method="post">
                            <button
                                type="submit"
                                class="btn btn-sm"
                                style="margin-top:1rem"
                            >
                                Create invite code
                            </button>
                        </form>
                        {codes.length > 0 && (
                            <ul style="margin-top:1rem">
                                {codes.map((code) => (
                                    <li>
                                        <code>{code.code}</code>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </article>
        </>,
    );
});

adminRouter.post("/signups", async (c) => {
    await setSignupsRestricted(!(await signupsRestricted()));
    return c.redirect("/admin", 303);
});

adminRouter.post("/invites", async (c) => {
    await db.insert(invites).values({ code: nanoid(10) });
    return c.redirect("/admin", 303);
});

adminRouter.post("/quota/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.parseBody();
    const back =
        typeof body.back === "string" && body.back.startsWith("?")
            ? body.back
            : "";

    const mb = Number(body.quota);
    const storageQuota =
        typeof body.quota === "string" &&
        body.quota.trim() !== "" &&
        Number.isFinite(mb) &&
        mb > 0
            ? Math.round(mb * 1024 * 1024)
            : null;

    await db
        .update(users)
        .set({ storageQuota })
        .where(eq(users.id, id));

    return c.redirect(`/admin${back}`, 303);
});

adminRouter.post("/block/:id", async (c) => {
    const id = Number(c.req.param("id"));
    // stay on the same search/page after the action
    const body = await c.req.parseBody();
    const back =
        typeof body.back === "string" && body.back.startsWith("?")
            ? body.back
            : "";
    const done = () => c.redirect(`/admin${back}`, 303);

    if (id === c.get("jwtPayload")?.id) {
        return done();
    }

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
        return done();
    }

    await db
        .update(users)
        .set({ blockedAt: user.blockedAt ? null : Date.now() })
        .where(eq(users.id, id));

    return done();
});
