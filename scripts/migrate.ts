import { readFileSync } from "fs"; import { sql } from "@/lib/db";
await sql.unsafe(readFileSync("lib/db/schema.sql", "utf8")); console.log("migrated"); await sql.end();
