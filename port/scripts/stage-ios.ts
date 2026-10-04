// Stages the iOS library sources for scriptc: its static build takes relative imports only and treats anything
// under node_modules as package code, so the engine, the shared package and the port are copied side by side and
// "dotframe/..." and "@craft-ones/shared" imports become relative paths. Also gathers the bundle's game folder.
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const port = join(import.meta.dir, "..");
const repo = join(port, "..");
const build = join(port, "ios", "build");
const tree = join(build, "tree");
const engine = join(port, "node_modules", "dotframe");
rmSync(tree, { recursive: true, force: true });
rmSync(join(build, "game"), { recursive: true, force: true });

const copies: [string, string][] = [
  [join(engine, "src"), join(tree, "dotframe", "src")],
  [join(port, "src"), join(tree, "port", "src")],
  [join(port, "ios", "app.ts"), join(tree, "port", "ios", "app.ts")],
  [join(port, "ios", "app.json"), join(tree, "port", "ios", "app.json")],
  [
    join(repo, "packages", "shared", "src"),
    join(tree, "packages", "shared", "src"),
  ],
  [
    join(repo, "apps", "web", "src", "game", "characters"),
    join(tree, "apps", "web", "src", "game", "characters"),
  ],
  [
    join(repo, "apps", "web", "src", "game", "weapons"),
    join(tree, "apps", "web", "src", "game", "weapons"),
  ],
];
for (const [from, to] of copies) cpSync(from, to, { recursive: true });

const rel = (file: string, target: string): string => {
  const r = relative(dirname(file), target);
  return r.startsWith(".") ? r : `./${r}`;
};
const rewrite = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) rewrite(path);
    else if (path.endsWith(".ts"))
      writeFileSync(
        path,
        readFileSync(path, "utf8")
          .replace(
            /(["'])dotframe\/src\/([^"']+)\1/g,
            (_m, q: string, sub: string) =>
              `${q}${rel(path, join(tree, "dotframe", "src", sub))}${q}`,
          )
          .replace(
            /(["'])@craft-ones\/shared\1/g,
            (_m, q: string) =>
              `${q}${rel(path, join(tree, "packages", "shared", "src"))}${q}`,
          ),
      );
  }
};
rewrite(tree);

const game = join(build, "game");
mkdirSync(game, { recursive: true });
cpSync(join(port, "assets", "art"), join(game, "assets", "art"), {
  recursive: true,
});
cpSync(join(port, "assets", "sfx"), join(game, "assets", "sfx"), {
  recursive: true,
});
cpSync(
  join(engine, "assets", "fonts"),
  join(game, "node_modules", "dotframe", "assets", "fonts"),
  { recursive: true },
);
console.log(`staged ${tree} and ${game}`);
