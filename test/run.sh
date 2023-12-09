#!/bin/sh -e

cd $(dirname $0)/yowasp_runtime_test
npm install
npm run pack
npm run transpile
npm run test