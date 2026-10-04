#!/bin/sh
# iOS build: stage sources, library glue, scriptc library, xcodegen, xcodebuild. Run from port/.
set -e
VENDOR="${DOTFRAME_VENDOR:-$HOME/Programming/crafter-games/dotframe/vendor}"
ln -sfn "$VENDOR" ios/vendor
bun scripts/stage-ios.ts
bun node_modules/dotframe/tools/gen-library-glue.ts ios/build/tree/port/ios/app.json ios/build
(cd ios/build && SCRIPTC_RUNTIME_PACK="${SCRIPTC_RUNTIME_PACK:-$HOME/.dotframe/scriptc-ios/node_modules/@scriptc/runtime-ios-arm64}" SCRIPTC_TARGET=aarch64-apple-ios scriptc build --lib --profile craftones.profile.json)
(cd ios && xcodegen generate)
(cd ios && xcodebuild -scheme CraftOnes -destination generic/platform=iOS -allowProvisioningUpdates -derivedDataPath build/derived build -quiet)
