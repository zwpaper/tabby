#!/bin/sh

# Run the example
bun \
    src/cli/index.tsx \
        -c examples/storybook/config.ts \
        "$@"
