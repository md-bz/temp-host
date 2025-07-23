import { Hono } from "hono";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { serveStatic } from "hono/bun";
import { getFile, HttpError, saveFile } from "./helper";

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
    console.log(id);

    try {
        const { data, filename } = await getFile(id);
        return c.body(data, 200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
        });
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
