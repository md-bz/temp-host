import { Hono } from "hono";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db/db";
import { files, invites, users } from "./db/schema";
import { adminAuth } from "./auth";
import { signupsRestricted, setSignupsRestricted } from "./helper";

export const adminRouter = new Hono();

adminRouter.use("*", adminAuth);

adminRouter.get("/", async (c) => {
    const rows = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            blockedAt: users.blockedAt,
            uploads: sql<number>`cast(count(${files.id}) as integer)`,
        })
        .from(users)
        .leftJoin(files, eq(files.userId, users.id))
        .groupBy(users.id)
        .orderBy(desc(users.id));

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
            <div style="overflow-x:auto">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Uploads</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((u) => (
                            <tr>
                                <td>{u.name}</td>
                                <td>{u.email}</td>
                                <td>{u.role}</td>
                                <td>{u.uploads}</td>
                                <td>{u.blockedAt ? "blocked" : "active"}</td>
                                <td>
                                    {u.id !== me && (
                                        <form
                                            action={`/admin/block/${u.id}`}
                                            method="post"
                                        >
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
        </>
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

adminRouter.post("/block/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (id === c.get("jwtPayload")?.id) {
        return c.redirect("/admin", 303);
    }

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
        return c.redirect("/admin", 303);
    }

    await db
        .update(users)
        .set({ blockedAt: user.blockedAt ? null : Date.now() })
        .where(eq(users.id, id));

    return c.redirect("/admin", 303);
});
