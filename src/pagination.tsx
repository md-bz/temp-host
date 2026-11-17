export const PAGE_SIZE = 20;

// 1-based; missing or junk falls back to the first page
export function pageParam(c: any, key: string) {
    const n = Number(c.req.query(key));
    return Number.isInteger(n) && n > 0 ? n : 1;
}

export function pageCount(total: number) {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

const pageHref = (url: string, key: string, page: number) => {
    const u = new URL(url);
    u.searchParams.set(key, String(page));
    return `${u.pathname}${u.search}`;
};

export const Pager = (props: {
    url: string;
    param: string;
    page: number;
    pages: number;
}) =>
    props.pages > 1 ? (
        <nav class="pager">
            {props.page > 1 ? (
                <a href={pageHref(props.url, props.param, props.page - 1)}>
                    ← Prev
                </a>
            ) : (
                <span />
            )}
            <small>
                page {props.page} / {props.pages}
            </small>
            {props.page < props.pages ? (
                <a href={pageHref(props.url, props.param, props.page + 1)}>
                    Next →
                </a>
            ) : (
                <span />
            )}
        </nav>
    ) : null;
