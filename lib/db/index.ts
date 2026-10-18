// Neon serverless driver over WebSockets (TCP 5432 is blocked here). All our tables live in schema "heygro".
// Small tagged-template adapter with the subset of the postgres.js API we use: sql`...`, sql(obj) for SET lists, sql.json, sql.begin, sql.unsafe.
import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws as any;
export const SCHEMA = "heygro";
type Frag = { __frag: true; text: (next: () => string) => string; values: unknown[] };
const isFrag = (v: any): v is Frag => v && v.__frag;
class Json { constructor(public v: unknown) {} }

const g = globalThis as unknown as { __pool?: Pool };
const pool = () => (g.__pool ??= new Pool({ connectionString: (process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL)!.replace("-pooler.", "."), max: 8 }) /* direct (session) endpoint so search_path sticks; pooler is transaction-mode */);

function build(strings: TemplateStringsArray, vals: unknown[]) {
  const values: unknown[] = []; const next = () => `$${values.length}`;
  let text = strings[0];
  vals.forEach((v, i) => {
    if (isFrag(v)) { const base = values.length; values.push(...v.values); let k = base; text += v.text(() => `$${++k}`); }
    else { values.push(v instanceof Json ? JSON.stringify(v.v) : v); text += next(); }
    text += strings[i + 1];
  });
  return { text, values };
}
async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c: any = await pool().connect();
  try { if (!c.__sp) { await c.query(`set search_path to ${SCHEMA}`); c.__sp = 1; } return await fn(c); } finally { c.release(); }
}
type Sql = (<T = any>(s: TemplateStringsArray | Record<string, unknown>, ...v: unknown[]) => any) & { json: (v: unknown) => Json; unsafe: (t: string) => Promise<any[]>; begin: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>; end: () => Promise<void> };
function make(run: (text: string, values: unknown[]) => Promise<any[]>, txRunner?: Sql["begin"]): Sql {
  const f: any = (s: any, ...v: unknown[]) => {
    if (!Array.isArray(s) || !(s as any).raw) { // sql(obj) → "a"=$1, "b"=$2 fragment for SET
      const entries = Object.entries(s as Record<string, unknown>);
      return { __frag: true, values: entries.map(([, x]) => x instanceof Json ? JSON.stringify(x.v) : x), text: (n: () => string) => entries.map(([k]) => `"${k}"=${n()}`).join(", ") } as Frag;
    }
    const q = build(s as unknown as TemplateStringsArray, v);
    return run(q.text, q.values);
  };
  f.json = (v: unknown) => new Json(v);
  f.unsafe = (t: string) => run(t, []);
  f.begin = txRunner;
  f.end = async () => { await g.__pool?.end(); g.__pool = undefined; };
  return f as Sql;
}
export const sql: Sql = make(
  (t, v) => withClient(async c => (await c.query(t, v as any[])).rows),
  (fn) => withClient(async c => {
    await c.query("begin");
    try { const r = await fn(make(async (t, v) => (await c.query(t, v as any[])).rows)); await c.query("commit"); return r; }
    catch (e) { await c.query("rollback"); throw e; }
  }),
);
