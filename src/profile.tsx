import { Hono } from "hono";
import { eq, ne, and, sql } from "drizzle-orm";
import * as argon2 from "argon2";
import { db } from "./db/db";
import { users } from "./db/schema";
import { htmlAuth } from "./auth";
import { ContentfulStatusCode } from "hono/utils/http-status";

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
            <button type="submit" class="btn">Save</button>
        </form>
    </article>
);

async function currentUser(c: any) {
    return await db
        .select()
        .from(users)
        .where(eq(users.id, c.get("jwtPayload")!.id))
        .get();
}

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
    const changingEmail =
        typedEmail.toLowerCase() !== user.email.toLowerCase();
    const email = changingEmail ? typedEmail : user.email;
    const newPassword = body.newPassword ?? "";
    const currentPassword = body.currentPassword ?? "";

    const fail = (error: string, status: ContentfulStatusCode = 400) =>
        c.render(<ProfileForm name={name} email={email} error={error} />, status);

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
                    ne(users.id, user.id)
                )
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
        </p>
    );
});
