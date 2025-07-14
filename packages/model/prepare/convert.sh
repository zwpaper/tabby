#!/bin/bash

bun run prepare/convert.js
cat data/output.json | jq -c '.[]' > data/output.jsonl
