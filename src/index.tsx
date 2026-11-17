import { Hono } from "hono";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { serveStatic } from "hono/bun";
import * as argon2 from "argon2";
import {
    fileAccessToken,
    getFileInfo,
    getText,
    HttpError,
    saveFile,
    saveText,
} from "./helper";
//@ts-ignore
import { formatDatetime } from "../static/helper";
import {} from "./cron";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { authRouter, htmlAuth } from "./auth";
import { adminRouter } from "./admin";
import { profileRouter } from "./profile";
import { limiter } from "./ratelimter";

const app = new Hono();

declare module "hono" {
    interface ContextRenderer {
        (content: string | Promise<string>, status?: ContentfulStatusCode):
            | Response
            | Promise<Response>;
    }
}

app.route("/api", api);

app.use(async (c, next) => {
    c.setRenderer((content, status) => {
        return c.html(<Layout>{content}</Layout>, status);
    });
    await next();
});

// this is placed here to inherit the layout app router
app.route("/auth", authRouter);
app.route("/admin", adminRouter);
app.route("/profile", profileRouter);

app.use("/static/*", serveStatic({ root: "./" }));

// Api docs
app.get("/api", htmlAuth, async (c) => {
    const token = c.req
        .header("Cookie")
        ?.split(";")
        .find((x) => x.startsWith("token="))
        ?.split("=")[1];

    const url = new URL(c.req.url).origin;

    return c.render(
        <article class="card">
            <h2>API</h2>
            <p>you need to set Authorization header with Bearer token:</p>
            <p>Authorization: Bearer {token}</p>
            <h3>API routes:</h3>
            <ul>
                <li>
                    <p>POST /api/file</p>
                    <p>needs Auth, is rate limited</p>
                    <p>can use age as part of form data for expiration</p>
                    <p>optional password form field protects the link</p>
                    <code>
                        curl -X POST "{url}/api/file" --header "Content-Type:
                        multipart/form-data" --header "Authorization: Bearer{" "}
                        {token}" --form "file=@/path/to/file" --form "age=1d"
                    </code>
                </li>
                <li>
                    <p>GET /api/file/:id</p>
                    <p>no auth/rate limit</p>
                    <code>wget --content-disposition {url}/api/file/id</code>
                </li>
            </ul>
        </article>
    );
});

app.on("GET", ["/", "/file"], htmlAuth, async (c) => {
    return c.render(
        <>
            <div class="forms">
                <article class="card">
                    <h4>Share file</h4>
                    <form
                        action="/file"
                        method="post"
                        enctype="multipart/form-data"
                    >
                        <label>
                            How long link is Available
                            <input
                                type="text"
                                name="age"
                                defaultValue="1d"
                                placeholder="10,10s,10m,10h,10d"
                            />
                        </label>
                        <label>
                            How many times can the link be downloaded
                            <input
                                type="number"
                                name="downloadCount"
                                defaultValue="100"
                                placeholder="100"
                            />
                        </label>
                        <label>
                            Password (optional)
                            <input
                                type="password"
                                name="password"
                                placeholder="leave empty for a public link"
                            />
                        </label>
                        <input type="file" name="file" required />

                        <button type="submit" class="btn">Upload</button>
                    </form>
                </article>
                <article class="card">
                    <h4>Share text</h4>
                    <form action="/text" method="post">
                        <label>
                            How long link is Available
                            <input
                                type="text"
                                name="age"
                                defaultValue="1d"
                                placeholder="10,10s,10m,10h,10d"
                            />
                        </label>
                        <label>
                            Password (optional)
                            <input
                                type="password"
                                name="password"
                                placeholder="leave empty for a public link"
                            />
                        </label>
                        <textarea
                            name="content"
                            required
                            placeholder="Paste your text here..."
                            style="min-height:200px"
                        ></textarea>
                        <button type="submit" class="btn">Share Text</button>
                    </form>
                </article>
            </div>
        </>
    );
});

app.post("/file", htmlAuth, limiter(), async (c) => {
    const body = await c.req.parseBody();
    try {
        const url = await saveFile(body, c.get("jwtPayload")?.id);
        return c.render(
            <p class="result">
                Your file is ready to download at{" "}
                <a href={`/file/${url}`}>{url}</a>
            </p>
        );
    } catch (e) {
        if (e instanceof HttpError) {
            return c.render(<p>{e.message}</p>, e.status);
        }

        return c.render(<p>Something went wrong</p>, 500);
    }
});

const FileInfo = (props: {
    file: Awaited<ReturnType<typeof getFileInfo>>;
    downloadUrl: string;
}) => (
    <article class="card">
        <header>
            <h4>filename: {props.file.filename}</h4>
        </header>
        <p>Download count: {props.file.downloadCount}</p>
        <p>Max download count: {props.file.maxDownloadCount}</p>
        <p>
            Expires at:{" "}
            <span id="expires-at" data-time={props.file.expiresAt}>
                {/* this will be replaced by client local time if js isn't blocked */}
                {formatDatetime(props.file.expiresAt)}
            </span>
        </p>
        <footer class="card-footer">
            <a href={props.downloadUrl} class="btn">Download</a>
        </footer>
        <script src="/static/clientTimestamp.js" type="module"></script>
    </article>
);

const FilePasswordForm = (props: { error?: string }) => (
    <article class="card">
        <header>
            <h4>Password protected</h4>
        </header>
        {props.error && <p class="result">{props.error}</p>}
        <form method="post">
            <label>
                Password <input type="password" name="password" required />
            </label>
            <button type="submit" class="btn">Unlock</button>
        </form>
    </article>
);

app.get("/file/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const file = await getFileInfo(id);

        if (file.password) {
            return c.render(<FilePasswordForm />);
        }

        return c.render(
            <FileInfo file={file} downloadUrl={`/api/file/${id}`} />
        );
    } catch (error) {
        if (error instanceof HttpError) {
            return c.render(<p>{error.message}</p>, error.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

app.post("/file/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const file = await getFileInfo(id);
        if (!file.password) return c.redirect(`/file/${id}`, 303);

        const body = await c.req.parseBody();
        const password = body["password"] as string;

        if (!(await argon2.verify(file.password, password ?? ""))) {
            return c.render(<FilePasswordForm error="Wrong password" />, 403);
        }

        return c.render(
            <FileInfo
                file={file}
                downloadUrl={`/api/file/${id}?access=${await fileAccessToken(file.url)}`}
            />
        );
    } catch (error) {
        if (error instanceof HttpError) {
            return c.render(<p>{error.message}</p>, error.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

app.post("/text", htmlAuth, limiter(), async (c) => {
    const body = await c.req.parseBody();
    try {
        const url = await saveText(body, c.get("jwtPayload")?.id);
        return c.render(
            <p class="result">
                Your text is available at{" "}
                <a href={`/text/${url}`}>{url}</a>
            </p>
        );
    } catch (e) {
        if (e instanceof HttpError) {
            return c.render(<p>{e.message}</p>, e.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

const TextContent = (props: {
    text: Awaited<ReturnType<typeof getText>>;
}) => (
    <article class="card">
        <pre style="white-space:pre-wrap;word-break:break-word;max-width:100%;">
            {props.text.content}
        </pre>
        <p>
            Expires at:{" "}
            <span id="expires-at" data-time={props.text.expiresAt}>
                {formatDatetime(props.text.expiresAt)}
            </span>
        </p>
        <script src="/static/clientTimestamp.js" type="module"></script>
    </article>
);

const TextPasswordForm = (props: { error?: string }) => (
    <article class="card">
        <header>
            <h4>Password protected</h4>
        </header>
        {props.error && <p class="result">{props.error}</p>}
        <form method="post">
            <label>
                Password <input type="password" name="password" required />
            </label>
            <button type="submit" class="btn">Unlock</button>
        </form>
    </article>
);

app.get("/text/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const text = await getText(id);

        if (text.password) {
            return c.render(<TextPasswordForm />);
        }

        return c.render(<TextContent text={text} />);
    } catch (error) {
        if (error instanceof HttpError) {
            return c.render(<p>{error.message}</p>, error.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

app.post("/text/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const text = await getText(id);
        if (!text.password) return c.redirect(`/text/${id}`, 303);

        const body = await c.req.parseBody();
        const password = body["password"] as string;

        if (!(await argon2.verify(text.password, password ?? ""))) {
            return c.render(<TextPasswordForm error="Wrong password" />, 403);
        }

        return c.render(<TextContent text={text} />);
    } catch (error) {
        if (error instanceof HttpError) {
            return c.render(<p>{error.message}</p>, error.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

export default app;
