import { FC } from "hono/jsx";

export const Layout: FC = (props) => {
    return (
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <title>Temp file</title>
                <link
                    rel="stylesheet"
                    href="/static/pico.classless.slate.min.css"
                />
            </head>
            <body>
                <main>{props.children}</main>
            </body>
        </html>
    );
};
