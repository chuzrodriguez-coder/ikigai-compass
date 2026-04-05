import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const ALLOWED_ORIGINS = [
  process.env["REPLIT_DEV_DOMAIN"] ? `https://${process.env["REPLIT_DEV_DOMAIN"]}` : null,
  process.env["REPLIT_DOMAINS"]?.split(",").map((d) => `https://${d.trim()}`),
].flat().filter(Boolean) as string[];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
      }
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    const message =
      err instanceof Error ? err.message : "Request error";
    res.status(status).json({ error: message });
    return;
  }
  logger.error(err, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
