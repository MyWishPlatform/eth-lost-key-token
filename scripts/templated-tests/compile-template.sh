#!/usr/bin/env bash
set -e
rm -rf build
rm -f contracts/LostKeyMain.sol
source $(dirname "$0")/templated-tests/preprocess-template.sh $1
node_modules/.bin/tronbox compile --all
node_modules/.bin/combine-contracts LostKeyMain
