import { Hono } from "hono";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { serveStatic } from "hono/bun";

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./" }));

app.get("/", (c) => {
    return c.html(
        <Layout>
            <h1>Hello world</h1>
        </Layout>
    );
});

app.route("/api", api);

export default app;
