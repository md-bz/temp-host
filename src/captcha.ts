import { createCanvas } from "@napi-rs/canvas";
import { createCaptcha } from "captcha-canvas";
import { db } from "./db/db";
import { captchas } from "./db/schema";
import { nanoid } from "nanoid";
import { toUnixDate } from "./helper";

export async function generateCaptcha() {
    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext("2d");

    //@ts-ignore
    const { text } = createCaptcha({ ctx });

    const id = nanoid();
    await db
        .insert(captchas)
        .values({ id, text, expiry: Date.now() + toUnixDate("10m") });

    return { id, buffer: canvas.toBuffer("image/png") };
}
