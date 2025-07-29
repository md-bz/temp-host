import { createCanvas } from "@napi-rs/canvas";
import { createCaptcha } from "captcha-canvas";
import { nanoid } from "nanoid";
import { toUnixDate } from "./helper";
import { redisClient } from "./db/redis";

export async function generateCaptcha() {
    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext("2d");

    //@ts-ignore
    const { text } = createCaptcha({ ctx });

    const id = nanoid();

    await redisClient.set(
        `captcha:${id}`,
        text,
        "EX",
        toUnixDate("10m") / 1000
    );

    return { id, buffer: canvas.toBuffer("image/png") };
}

export async function isCaptchaValid(id: string, text: string) {
    const captcha = await redisClient.get(`captcha:${id}`);
    if (!captcha) return false;

    await redisClient.del(`captcha:${id}`);

    if (!captcha || captcha.toLowerCase() !== text.toLowerCase()) {
        return false;
    }
    return true;
}
