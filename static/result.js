const btn = document.querySelector("[data-copy]");
const link = btn.dataset.copy;

btn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(link);
    } catch {
        // no clipboard API outside a secure context: copy from a temp field
        const field = document.createElement("textarea");
        field.value = link;
        document.body.append(field);
        field.select();
        document.execCommand("copy");
        field.remove();
    }

    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy link"), 1500);
});
