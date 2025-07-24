#!/usr/bin/env sh

bun x tsc --noEmit -p tsconfig.json | grep "$@"
