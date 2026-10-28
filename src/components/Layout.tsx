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
                <link rel="stylesheet" href="/static/styles.css" />
            </head>
            <header class="site-header">
                <nav>
                    <a href="/" class="brand">
                        <span class="primary">Temp</span>
                        file
                    </a>
                    <ul>
                        <li>
                            <a href="/">Home</a>
                        </li>
                        <li>
                            <a href="/api">API</a>
                        </li>
                    </ul>
                </nav>
            </header>
            <body>
                <main class="page">{props.children}</main>
            </body>
        </html>
    );
};
