import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { eq, and, isNull } from "drizzle-orm";
import * as argon2 from "argon2";
import { db } from "./db/db";
import { invites, users } from "./db/schema";
import { signupsRestricted } from "./helper";
import { setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { generateCaptcha, isCaptchaValid } from "./captcha";

export const authRouter = new Hono();

// Signup form
authRouter.get("/signup", async (c) => {
    const { id, buffer } = await generateCaptcha();
    const restricted = await signupsRestricted();

    return c.render(
        <article class="card">
            <header style="text-align:center">
                <h4>Welcome, signup</h4>
            </header>
            <form action="/auth/signup" method="post">
                {restricted && (
                    <label>
                        Invite code{" "}
                        <input type="text" name="inviteCode" required />
                    </label>
                )}
                <label>
                    Name <input type="text" name="name" required />
                </label>
                <label>
                    Email <input type="email" name="email" required />
                </label>
                <label>
                    Password <input type="password" name="password" required />
                </label>
                <input type="hidden" name="captchaId" value={id} />
                <img
                    class="captcha"
                    src={`data:image/png;base64,${buffer.toString("base64")}`}
                    alt="captcha"
                />
                <label>
                    Enter Captcha{" "}
                    <input
                        type="text"
                        name="captchaText"
                        required
                        autoComplete="off"
                    />
                </label>
                <button type="submit" class="btn">
                    Signup
                </button>
            </form>
            <div style="text-align:center">
                <small>
                    already have an account? <a href="/auth/login">login</a>
                </small>
            </div>
        </article>,
    );
});

// Signup handler
authRouter.post("/signup", async (c) => {
    const body = await c.req.parseBody();
    const { name, email, password, captchaId, captchaText } = body as Record<
        string,
        string
    >;

    const isValid = await isCaptchaValid(captchaId, captchaText);
    if (!isValid) {
        return c.render(
            <article>
                <h2>Invalid or expired captcha</h2>
                <a href="/auth/signup">Try again</a>
            </article>,
            400,
        );
    }

    const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();

    if (existingUser) {
        return c.render(
            <article>
                <h2>Email already exists</h2>
                <a href="/auth/signup">Try again</a>
            </article>,
            400,
        );
    }

    let invite: typeof invites.$inferSelect | undefined;
    if (await signupsRestricted()) {
        const code = (body as Record<string, string>).inviteCode?.trim();
        invite = code
            ? await db
                  .select()
                  .from(invites)
                  .where(eq(invites.code, code))
                  .get()
            : undefined;

        if (!invite || invite.usedAt) {
            return c.render(
                <article>
                    <h2>Invalid or used invite code</h2>
                    <a href="/auth/signup">Try again</a>
                </article>,
                400,
            );
        }
    }

    const hash = await argon2.hash(password);
    const [created] = await db
        .insert(users)
        .values({ name, email, password: hash })
        .returning();

    if (invite) {
        // mark atomically so the same code can't be used twice concurrently
        const marked = await db
            .update(invites)
            .set({ usedAt: Date.now(), usedBy: created.id })
            .where(and(eq(invites.id, invite.id), isNull(invites.usedAt)))
            .returning();

        if (marked.length === 0) {
            await db.delete(users).where(eq(users.id, created.id));
            return c.render(
                <article>
                    <h2>Invalid or used invite code</h2>
                    <a href="/auth/signup">Try again</a>
                </article>,
                400,
            );
        }
    }

    return c.render(
        <article>
            <h2>User created successfully</h2>
            <a href="/auth/login">Login now</a>
        </article>,
        201,
    );
});

// Login form
authRouter.get("/login", async (c) => {
    const { id, buffer } = await generateCaptcha();

    return c.render(
        <article class="card">
            <header style="text-align:center">
                <h4>Welcome back, Login</h4>
            </header>
            <form action="/auth/login" method="post">
                <label>
                    Email <input type="email" name="email" required />
                </label>
                <label>
                    Password <input type="password" name="password" required />
                </label>
                <input type="hidden" name="captchaId" value={id} />
                <img
                    class="captcha"
                    src={`data:image/png;base64,${buffer.toString("base64")}`}
                    alt="captcha"
                />
                <label>
                    Enter Captcha{" "}
                    <input
                        type="text"
                        name="captchaText"
                        required
                        autoComplete="off"
                    />
                </label>
                <button type="submit" class="btn">
                    Login
                </button>
            </form>
            <div style="text-align:center">
                <small>
                    don't have an account? <a href="/auth/signup">signup</a>
                </small>
            </div>
        </article>,
    );
});

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
}
export const jwtSecret = process.env.JWT_SECRET;

// Login handler
authRouter.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const { email, password, captchaId, captchaText } = body as Record<
        string,
        string
    >;

    const isValid = await isCaptchaValid(captchaId, captchaText);
    if (!isValid) {
        return c.render(
            <article>
                <h2>Invalid or expired captcha</h2>
                <a href="/auth/login">Try again</a>
            </article>,
            400,
        );
    }

    const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();
    if (!user || !(await argon2.verify(user.password, password))) {
        return c.render(
            <article>
                <h2>Invalid email or password</h2>
                <a href="/auth/login">Try again</a>
            </article>,
            401,
        );
    }

    if (user.blockedAt) {
        return c.render(
            <article>
                <h2>Your account has been blocked</h2>
            </article>,
            403,
        );
    }

    const token = await sign({ id: user.id }, process.env.JWT_SECRET!);

    setCookie(c, "token", token, {
        expires: new Date(new Date().setDate(new Date().getDate() + 7)),
        secure: true,
        sameSite: "None",
        httpOnly: true,
    });
    return c.redirect("/", 301);
});

authRouter.get("/logout", (c) => {
    deleteCookie(c, "token");
    return c.redirect("/auth/login", 302);
});

const skipAuth = process.env.SKIP_AUTH === "true";

const cookieToken = (c: any) =>
    c.req
        .header("Cookie")
        ?.split(";")
        .find((x: string) => x.startsWith("token="))
        ?.split("=")[1];

async function userFromToken(token?: string) {
    if (!token) return;
    try {
        const payload = await verify(token, jwtSecret);
        return await db
            .select()
            .from(users)
            .where(eq(users.id, payload.id as number))
            .get();
    } catch {
        return;
    }
}

export const htmlAuth = createMiddleware(async (c, next) => {
    if (skipAuth) return await next();

    const user = await userFromToken(cookieToken(c));
    if (!user || user.blockedAt) {
        return c.redirect("/auth/login", 302);
    }

    c.set("jwtPayload", { id: user.id });
    await next();
});

export const jsonAuth = createMiddleware(async (c, next) => {
    if (skipAuth) return await next();

    const token = c.req.header("Authorization")?.split("Bearer ")[1];

    if (!token) {
        return c.json({ error: "No token" }, 401);
    }

    const user = await userFromToken(token);
    if (!user) {
        return c.json({ error: "Invalid token" }, 401);
    }
    if (user.blockedAt) {
        return c.json({ error: "Account blocked" }, 403);
    }

    c.set("jwtPayload", { id: user.id });
    await next();
});

export const adminAuth = createMiddleware(async (c, next) => {
    if (skipAuth) return await next();

    const user = await userFromToken(cookieToken(c));
    if (!user || user.blockedAt) {
        return c.redirect("/auth/login", 302);
    }
    if (user.role !== "admin") {
        return c.render(<h2>Forbidden</h2>, 403);
    }

    c.set("jwtPayload", { id: user.id });
    await next();
});

// promotes ADMIN_EMAIL to admin, creating the account if it doesn't exist
const adminEmail = process.env.ADMIN_EMAIL;
if (adminEmail) {
    const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .get();

    if (!existing) {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            throw new Error("ADMIN_PASSWORD is not set");
        }
        await db.insert(users).values({
            name: "Admin",
            email: adminEmail,
            password: await argon2.hash(adminPassword),
            role: "admin",
        });
    } else if (existing.role !== "admin") {
        await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, existing.id));
    }
}
