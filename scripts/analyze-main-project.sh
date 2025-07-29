#!/usr/bin/env sh

bun run build >/dev/null 2>&1
bun run build:executable >/dev/null 2>&1

xcp -o --no-progress ./pendant ../drawing/pendant >/dev/null 2>&1

cd ../drawing >/dev/null 2>&1 || exit >/dev/null 2>&1

./pendant analyze -V

cd - >/dev/null 2>&1 || exit >/dev/null 2>&1
