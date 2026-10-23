import { sql } from "@/lib/db";
const q = process.argv[2]; console.log(JSON.stringify(await sql.unsafe(q), null, 0).slice(0, 3000)); process.exit(0);
