#!/bin/sh -e

./node_modules/.bin/jco new ../copy.wasm \
  --wasi-command \
  --output copy.wasm
./node_modules/.bin/jco transpile copy.wasm \
  --instantiation async \
  --no-typescript \
  --no-namespaced-exports \
  --map 'wasi:io/*=runtime#io' \
  --map 'wasi:cli/*=runtime#cli' \
  --map 'wasi:clocks/*=runtime#*' \
  --map 'wasi:filesystem/*=runtime#fs' \
  --out-dir gen/
