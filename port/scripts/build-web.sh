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
# shasum on macOS, sha256sum in the Linux build image.
hash=$( (command -v shasum >/dev/null && shasum -a 256 "$out/main.js" || sha256sum "$out/main.js") | cut -c1-10)
[ -n "$hash" ] || { echo "no sha256 tool for the bundle hash" >&2; exit 1; }
mv "$out/main.js" "$out/main.$hash.js"
# The base keeps relative URLs under /play/ when nginx serves this page at / for Discord.
sed -e "s#./main.js#./main.$hash.js#" -e 's#<head>#<head>\n    <base href="/play/" />#' index.html > "$out/index.html"
cp -R assets "$out/"
cp -R node_modules/dotframe/assets/fonts "$out/node_modules/dotframe/assets/"
du -sh "$out" | cut -f1
