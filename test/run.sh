#!/bin/sh -e

cd $(dirname $0)/yowasp_runtime_test
rm -rf node_modules

npm install
npm run transpile
npm run pack
npm run test