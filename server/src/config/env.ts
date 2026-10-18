import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(20).default(5),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_UPLOAD_BASE: z.enum(["project", "home"]).default("project"),
  LOCAL_UPLOAD_DIR: z.string().min(1).default("data/uploads"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_PREFIX: z.string().default("parautos"),
  S3_FORCE_PATH_STYLE: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean(),
  ).default(false),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_TOKEN: z.string().min(32).max(512)
});

export type Environment = z.infer<typeof environmentSchema>;

let loadedEnvironment: Environment | undefined;

export function getEnvironment(): Environment {
  if (loadedEnvironment) return loadedEnvironment;

  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  loadedEnvironment = parsed.data;
  return loadedEnvironment;
}
