#!/bin/sh
# iOS build: stage sources, library glue, scriptc library, xcodegen, xcodebuild. Run from port/.
set -e
VENDOR="${DOTFRAME_VENDOR:-$HOME/Programming/crafter-games/dotframe/vendor}"
ln -sfn "$VENDOR" ios/vendor
bun scripts/stage-ios.ts
# App icon from the brand master (1024px): iOS derives every other size.
ICONS=ios/build/Assets.xcassets/AppIcon.appiconset
mkdir -p "$ICONS"
cp ../assets/brand/icon-master.png "$ICONS/icon-1024.png"
printf '{"images":[{"filename":"icon-1024.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}\n' > "$ICONS/Contents.json"
printf '{"info":{"author":"xcode","version":1}}\n' > ios/build/Assets.xcassets/Contents.json
bun node_modules/dotframe/tools/gen-library-glue.ts ios/build/tree/port/ios/app.json ios/build
(cd ios/build && SCRIPTC_RUNTIME_PACK="${SCRIPTC_RUNTIME_PACK:-$HOME/.dotframe/scriptc-ios/node_modules/@scriptc/runtime-ios-arm64}" SCRIPTC_TARGET=aarch64-apple-ios scriptc build --lib --profile craftones.profile.json)
(cd ios && xcodegen generate)
(cd ios && xcodebuild -scheme CraftOnes -destination generic/platform=iOS -allowProvisioningUpdates -derivedDataPath build/derived build -quiet)
