import { Hono } from "hono";
import { eq, ne, and, sql, desc } from "drizzle-orm";
import * as fs from "fs/promises";
import * as argon2 from "argon2";
import { db } from "./db/db";
import { files, users } from "./db/schema";
import { htmlAuth } from "./auth";
import { ContentfulStatusCode } from "hono/utils/http-status";
//@ts-ignore
import { formatDatetime } from "../static/helper";

export const profileRouter = new Hono();

profileRouter.use("*", htmlAuth);

const ProfileForm = (props: {
    name: string;
    email: string;
    error?: string;
}) => (
    <article class="card">
        <h4>Profile</h4>
        {props.error && <p class="result">{props.error}</p>}
        <form method="post">
            <label>
                Name
                <input
                    type="text"
                    name="name"
                    value={props.name}
                    placeholder="leave empty to keep current"
                />
            </label>
            <label>
                Email
                <input
                    type="email"
                    name="email"
                    value={props.email}
                    placeholder="leave empty to keep current"
                />
            </label>
            <label>
                New password
                <input
                    type="password"
                    name="newPassword"
                    placeholder="leave empty to keep current"
                />
            </label>
            <label>
                Current password
                <input
                    type="password"
                    name="currentPassword"
                    placeholder="needed to change email or password"
                />
            </label>
            <button type="submit" class="btn">
                Save
            </button>
        </form>
        <div style="text-align:center">
            <small>
                <a href="/auth/logout">logout</a>
            </small>
        </div>
    </article>
);

async function currentUser(c: any) {
    return await db
        .select()
        .from(users)
        .where(eq(users.id, c.get("jwtPayload")!.id))
        .get();
}

profileRouter.get("/files", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.redirect("/auth/login", 302);

    const rows = await db
        .select()
        .from(files)
        .where(eq(files.userId, user.id))
        .orderBy(desc(files.uploadedAt));

    const size = (bytes: number) =>
        bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(1)} KB`
            : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    return c.render(
        <article class="card wide">
            <h4>My files</h4>
            {rows.length === 0 ? (
                <p>No files uploaded yet.</p>
            ) : (
                <div style="overflow-x:auto">
                    <table>
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Size</th>
                                <th>Downloads</th>
                                <th>Expires</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((f) => {
                                const expired =
                                    f.expiresAt < Date.now() ||
                                    f.downloadCount >= f.maxDownloadCount;
                                return (
                                    <tr>
                                        <td>
                                            <a href={`/file/${f.url}`}>
                                                {f.filename}
                                            </a>
                                        </td>
                                        <td>{size(f.size)}</td>
                                        <td>
                                            {f.downloadCount}/
                                            {f.maxDownloadCount}
                                        </td>
                                        <td>{formatDatetime(f.expiresAt)}</td>
                                        <td>
                                            {expired ? "expired" : "active"}
                                        </td>
                                        <td>
                                            <form
                                                action={`/profile/files/${f.id}/delete`}
                                                method="post"
                                                onsubmit="return confirm('Delete this file?')"
                                            >
                                                <button
                                                    type="submit"
                                                    class="btn btn-sm"
                                                >
                                                    Delete
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </article>,
    );
});

profileRouter.post("/files/:id/delete", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.redirect("/auth/login", 302);

    const id = Number(c.req.param("id"));
    const file = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.userId, user.id)))
        .get();

    if (file) {
        try {
            await fs.unlink(file.storagePath);
        } catch (error) {
            // already gone from disk: safe to drop the row
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                console.error(error);
                return c.render(
                    <article class="card">
                        <h4>Could not delete file</h4>
                        <p>{file.filename} could not be removed, nothing was deleted.</p>
                        <a href="/profile/files">Back to files</a>
                    </article>,
                    500
                );
            }
        }

        await db.delete(files).where(eq(files.id, file.id));
    }

    return c.redirect("/profile/files", 303);
});

profileRouter.get("/", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.redirect("/auth/login", 302);

    return c.render(<ProfileForm name={user.name} email={user.email} />);
});

profileRouter.post("/", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.redirect("/auth/login", 302);

    const body = (await c.req.parseBody()) as Record<string, string>;
    const name = body.name?.trim() || user.name;
    const typedEmail = body.email?.trim() || user.email;
    // same email (any casing) or empty = not changed
    const changingEmail = typedEmail.toLowerCase() !== user.email.toLowerCase();
    const email = changingEmail ? typedEmail : user.email;
    const newPassword = body.newPassword ?? "";
    const currentPassword = body.currentPassword ?? "";

    const fail = (error: string, status: ContentfulStatusCode = 400) =>
        c.render(
            <ProfileForm name={name} email={email} error={error} />,
            status,
        );

    const changingPassword = newPassword.length > 0;

    if (changingEmail || changingPassword) {
        if (!(await argon2.verify(user.password, currentPassword))) {
            return fail("Current password is incorrect", 403);
        }
    }

    if (changingEmail) {
        const taken = await db
            .select()
            .from(users)
            .where(
                and(
                    sql`lower(${users.email}) = ${email.toLowerCase()}`,
                    ne(users.id, user.id),
                ),
            )
            .get();
        if (taken) {
            return fail("Email already exists");
        }
    }

    await db
        .update(users)
        .set({
            name,
            email,
            ...(changingPassword && {
                password: await argon2.hash(newPassword),
            }),
        })
        .where(eq(users.id, user.id));

    return c.render(
        <p class="result">
            Profile updated. <a href="/">Back to home</a>
        </p>,
    );
});
