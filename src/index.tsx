import { Hono } from "hono";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { serveStatic } from "hono/bun";
import { getFileInfo, HttpError, saveFile } from "./helper";
//@ts-ignore
import { formatDatetime } from "../static/helper";
import {} from "./cron";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { authRouter, htmlAuth, jwtSecret } from "./auth";
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
        <article>
            <h2>API</h2>
            <p>you need to set Authorization header with Bearer token:</p>
            <p>Authorization: Bearer {token}</p>
            <h3>API routes:</h3>
            <ul>
                <li>
                    <p>POST /api/file</p>
                    <p>needs Auth, is rate limited</p>
                    <p>can use age as part of form data for expiration</p>
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
        <article>
            <form action="/file" method="post" enctype="multipart/form-data">
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
                <input type="file" name="file" />

                <button type="submit">Upload</button>
            </form>
        </article>
    );
});

app.post("/file", htmlAuth, limiter(), async (c) => {
    const body = await c.req.parseBody();
    try {
        const url = await saveFile(body);
        return c.render(
            <p>
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

app.get("/file/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const { filename, downloadCount, maxDownloadCount, expiresAt } =
            await getFileInfo(id);

        return c.render(
            <article>
                <header>
                    <h4>filename: {filename}</h4>
                </header>
                <p>Download count: {downloadCount}</p>
                <p>Max download count: {maxDownloadCount}</p>
                <p>
                    Expires at:{" "}
                    <span id="expires-at" data-time={expiresAt}>
                        {/* this will be replaced by client local time if js isn't blocked */}
                        {formatDatetime(expiresAt)}
                    </span>
                </p>
                <footer>
                    <a href={`/api/file/${id}`}>Download</a>
                </footer>
                <script src="/static/clientTimestamp.js" type="module"></script>
            </article>
        );
    } catch (error) {
        if (error instanceof HttpError) {
            return c.render(<p>{error.message}</p>, error.status);
        }
        return c.render(<p>Something went wrong</p>, 500);
    }
});

export default app;
