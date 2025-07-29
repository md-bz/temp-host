import RedisStore, { RedisReply } from "rate-limit-redis";
import RedisClient from "ioredis";
import { rateLimiter, Store } from "hono-rate-limiter";
import { toUnixDate } from "./helper";
import { createMiddleware } from "hono/factory";

if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL environment variable is not set");
}

const redisClient = new RedisClient(process.env.REDIS_URL);

const store = new RedisStore({
    sendCommand: (...args) => {
        //@ts-ignore
        return redisClient.call(...args) as Promise<RedisReply>;
    },
}) as unknown as Store;

export const limiter = (type: "json" | "html" = "html") =>
    process.env.RATE_LIMIT_SKIP === "true"
        ? createMiddleware((c, next) => next())
        : rateLimiter({
              windowMs: toUnixDate(process.env.RATE_LIMIT_WINDOW || "15m"),
              limit: process.env.RATE_LIMIT_COUNT
                  ? Number(process.env.RATE_LIMIT_COUNT)
                  : 10,
              handler: (c) => {
                  if (type === "html")
                      return c.render(
                          <h2>Too many requests, please try again later.</h2>,
                          429
                      );
                  return c.json(
                      { error: "Too many requests, please try again later." },
                      429
                  );
              },
              keyGenerator: (c) => {
                  const jwt = c.get("jwtPayload");
                  if (jwt) {
                      return jwt.id;
                  }
                  return "everyone";
              },
              store,
          });
