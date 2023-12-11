#!/bin/sh -e

cd $(dirname $0)/yowasp_runtime_test
npm install
npm run transpile
npm run pack
npm run test