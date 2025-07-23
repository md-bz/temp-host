import { Hono } from "hono";
import { getFile, HttpError, saveFile } from "./helper";

export const api = new Hono();

api.post("/file", async (c) => {
    const body = await c.req.parseBody();

    try {
        const url = await saveFile(body);
        return c.json({ url });
    } catch (error) {
        if (error instanceof HttpError) {
            return c.json({ error: error.message }, error.status);
        }
        return c.json({ error: "something went wrong" }, 500);
    }
});

api.get("/file/:id", async (c) => {
    const id = c.req.param("id");

    try {
        const { data, filename } = await getFile(id);
        return c.body(data, 200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
        });
    } catch (error) {
        if (error instanceof HttpError) {
            return c.json({ error: error.message }, error.status);
        }
        return c.json({ error: "something went wrong" }, 500);
    }
});
