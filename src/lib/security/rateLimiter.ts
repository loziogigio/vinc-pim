import { RateLimiterMemory } from "rate-limiter-flexible";

const DEFAULT_POINTS = Number(process.env.RATE_LIMIT_POINTS ?? 40);
const DEFAULT_DURATION = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60);

const limiter = new RateLimiterMemory({
  points: DEFAULT_POINTS,
  duration: DEFAULT_DURATION
});

export const consumeRateLimit = async (key: string) => {
  await limiter.consume(key);
};

export const getClientKey = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first) {
      return first.trim();
    }
  }
  return request.headers.get("x-real-ip") ?? "anonymous";
};
