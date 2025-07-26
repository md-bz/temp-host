import { Hono } from "hono";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { serveStatic } from "hono/bun";
import { getFileInfo, HttpError, saveFile } from "./helper";
//@ts-ignore
import { formatDatetime } from "../static/helper";
import {} from "./cron";

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./" }));

app.on("GET", ["/", "/file"], (c) => {
    return c.html(
        <Layout>
            <article>
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
                    <input type="file" name="file" />

                    <button type="submit">Upload</button>
                </form>
            </article>
        </Layout>
    );
});

app.post("/file", async (c) => {
    const body = await c.req.parseBody();
    try {
        const url = await saveFile(body);
        return c.html(
            <Layout>
                <p>
                    Your file is ready to download at{" "}
                    <a href={`/file/${url}`}>{url}</a>
                </p>
            </Layout>
        );
    } catch (e) {
        if (e instanceof HttpError) {
            return c.html(
                <Layout>
                    <p>{e.message}</p>
                </Layout>,
                e.status
            );
        }

        return c.html(
            <Layout>
                <p>Something went wrong</p>
            </Layout>,
            500
        );
    }
});

app.get("/file/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const { filename, downloadCount, maxDownloadCount, expiresAt } =
            await getFileInfo(id);

        return c.html(
            <Layout>
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
                    <script
                        src="/static/clientTimestamp.js"
                        type="module"
                    ></script>
                </article>
            </Layout>
        );
    } catch (error) {
        if (error instanceof HttpError) {
            return c.html(
                <Layout>
                    <p>{error.message}</p>
                </Layout>,
                error.status
            );
        }
        return c.html(
            <Layout>
                <p>Something went wrong</p>
            </Layout>,
            500
        );
    }
});

app.route("/api", api);

export default app;
