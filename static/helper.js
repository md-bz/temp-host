/**
 *gets timestamp in ms and returns a formatted date
 */
export function formatDatetime(timestamp) {
    if (!timestamp) return `never`;
    const d = new Date(Number(timestamp));
    const yy = d.getFullYear().toString();
    const mm = String(d.getMonth() + 1);
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yy}/${mm}/${dd} ${hh}:${min}`;
}
