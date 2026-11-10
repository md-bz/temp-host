import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db/db";
import { files, users } from "./db/schema";
import { adminAuth } from "./auth";

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

    return c.render(
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
    );
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
