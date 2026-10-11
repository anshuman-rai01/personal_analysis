import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.SQL_HOST || "localhost";
const sqlPort = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
const sqlDbName = process.env.SQL_DB_NAME || "postgres";
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || "postgres";
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || "postgres";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost,
    port: sqlPort,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  },
  verbose: true,
});
