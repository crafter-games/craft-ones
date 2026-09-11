import { cpSync } from "node:fs";
import { join } from "node:path";

if (process.env.VERCEL) process.exit(0);

const web = join(import.meta.dir, "../apps/web");
const standalone = join(web, ".next/standalone/apps/web");
cpSync(join(web, "public"), join(standalone, "public"), { recursive: true });
cpSync(join(web, ".next/static"), join(standalone, ".next/static"), {
  recursive: true,
});
