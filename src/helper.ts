export function toUnixDate(
    input: string | number,
    defaultTime: number = 0
): number {
    if (typeof input === "number") {
        return input;
    }

    if (/^\d+$/.test(input)) {
        return parseInt(input, 10);
    }

    const unit = input.slice(-1);
    const numPart = input.slice(0, -1);
    const value = parseInt(numPart, 10);

    if (isNaN(value)) {
        return defaultTime;
    }

    if (unit === "h") {
        return value * 60 * 60 * 1000;
    }

    if (unit === "d") {
        return value * 24 * 60 * 60 * 1000;
    }

    if (unit === "m") {
        return value * 60 * 1000;
    }

    return defaultTime;
}
