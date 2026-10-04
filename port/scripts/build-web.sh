#!/bin/sh
# Web build into dist/web: rasterized art, dotframe fonts, and a content-hashed bundle so no cache serves a stale one.
set -e
cd "$(dirname "$0")/.."
out=dist/web
rm -rf "$out"
mkdir -p "$out/node_modules/dotframe/assets"
[ -d assets/art ] || bun tools/rasterize.ts
[ -d assets/sfx ] || bun tools/synth-sounds.ts
bun build main.web.ts --outfile "$out/main.js" --target browser --minify
hash=$(shasum -a 256 "$out/main.js" | cut -c1-10)
mv "$out/main.js" "$out/main.$hash.js"
sed "s#./main.js#./main.$hash.js#" index.html > "$out/index.html"
cp -R assets "$out/"
cp -R node_modules/dotframe/assets/fonts "$out/node_modules/dotframe/assets/"
du -sh "$out" | cut -f1
