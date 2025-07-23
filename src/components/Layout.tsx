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
            <header>
                <nav>
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
                <main style="display: flex; height:80vh; align-items: center; justify-content: center;">
                    {props.children}
                </main>
            </body>
        </html>
    );
};
