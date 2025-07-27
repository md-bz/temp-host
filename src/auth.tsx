import { Hono } from "hono";
import { jwt, sign, verify } from "hono/jwt";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import { db } from "./db/db";
import { users } from "./db/schema";
import { setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

export const authRouter = new Hono();

// Signup form
authRouter.get("/signup", (c) =>
    c.render(
        <article>
            <form action="/auth/signup" method="post">
                <label>
                    Name <input type="text" name="name" />
                </label>
                <label>
                    Email <input type="email" name="email" />
                </label>
                <label>
                    Password <input type="password" name="password" />
                </label>
                <button type="submit">Signup</button>
            </form>
        </article>
    )
);

// Signup handler
authRouter.post("/signup", async (c) => {
    const body = await c.req.parseBody();
    const { name, email, password } = body as Record<string, string>;

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
            400
        );
    }

    const hash = await argon2.hash(password);
    await db.insert(users).values({ name, email, password: hash });

    return c.render(
        <article>
            <h2>User created successfully</h2>
            <a href="/auth/login">Login now</a>
        </article>,
        201
    );
});

// Login form
authRouter.get("/login", (c) =>
    c.render(
        <article>
            <form action="/auth/login" method="post">
                <label>
                    Email <input type="email" name="email" />
                </label>
                <label>
                    Password <input type="password" name="password" />
                </label>
                <button type="submit">Login</button>
            </form>
        </article>
    )
);

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
}
export const jwtSecret = process.env.JWT_SECRET;

// Login handler
authRouter.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const { email, password } = body as Record<string, string>;

    const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();

    if (!user) {
        return c.render(
            <article>
                <h2>Invalid email or password</h2>
                <a href="/auth/login">Try again</a>
            </article>,
            401
        );
    }

    const match = await argon2.verify(user.password, password);
    if (!match) {
        return c.render(
            <article>
                <h2>Invalid email or password</h2>
                <a href="/auth/login">Try again</a>
            </article>,
            401
        );
    }

    const token = await sign({ id: user.id }, process.env.JWT_SECRET!);

    setCookie(c, "token", token, {
        expires: new Date(new Date().setDate(new Date().getDate() + 7)),
        secure: true,
        sameSite: "None",
        httpOnly: true,
    });
    return c.render(
        <article>
            <h2>Login successful</h2>
            <a href="/auth/me">Go to profile</a>
        </article>
    );
});

const skipAuth = process.env.SKIP_AUTH === "true";

export const htmlAuth = createMiddleware(async (c, next) => {
    if (skipAuth) await next();

    const token = c.req
        .header("Cookie")
        ?.split(";")
        .find((x) => x.startsWith("token="))
        ?.split("=")[1];

    if (!token) {
        return c.render(<h2>You need to login first</h2>, 401);
    }

    try {
        const res = await verify(token, jwtSecret);
        c.set("jwtPayload", res);
    } catch (error) {
        return c.render(
            <h3>
                Invalid token, <a href="/auth/login">login again</a>
            </h3>,
            401
        );
    }

    await next();
});

export const jsonAuth = createMiddleware(async (c, next) => {
    if (skipAuth) await next();

    const token = c.req.header("Authorization")?.split("Bearer ")[1];

    if (!token) {
        return c.json({ error: "No token" }, 401);
    }

    try {
        const res = await verify(token, jwtSecret);
        c.set("jwtPayload", res);
    } catch (error) {
        return c.json({ error: "Invalid token" }, 401);
    }

    await next();
});
