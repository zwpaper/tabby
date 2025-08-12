#!/bin/bash
set -ex

build_js() {
        bun build src/cli.ts --banner='import * as undici from "undici";' \
        --target bun \
        --outdir ./dist
}

build_exe() {
        bun build src/cli.ts --banner='import * as undici from "undici";' \
        --asset-naming="[name].[ext]" \
        --compile \
        --outfile ./dist/pochi-runner
}

build_exe