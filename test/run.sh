#!/bin/sh -e

cd $(dirname $0)

cd yowasp_runtime_test
./build.sh
npm run test