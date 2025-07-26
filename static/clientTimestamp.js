import { formatDatetime } from "./helper.js";

const el = document.getElementById("expires-at");
const ts = el.dataset.time;
const res = formatDatetime(ts);

el.textContent = res;
