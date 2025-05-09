#!/bin/bash

# get current bash file directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LLAMA_CPP_PATH="${PROJECT_ROOT}/crates/llama-cpp-server/llama.cpp"

# Input variables
LLAMA_CPP_VERSION=${LLAMA_CPP_VERSION:-$(cd ${LLAMA_CPP_PATH} && git fetch --tags origin >/dev/null && git describe --tags --abbrev=0)}
echo "LLAMA_CPP_VERSION=${LLAMA_CPP_VERSION}"
LLAMA_CPP_PLATFORM=${LLAMA_CPP_PLATFORM:-win-cuda-cu11.7-x64}
OUTPUT_NAME=${OUTPUT_NAME:-tabby_x86_64-windows-msvc-cuda117}

NAME=llama-${LLAMA_CPP_VERSION}-bin-${LLAMA_CPP_PLATFORM}
ZIP_FILE=${NAME}.zip

if [[ ${LLAMA_CPP_PLATFORM} == win* ]]; then
    TABBY_BINARY=${TABBY_BINARY:-tabby_x86_64-windows-msvc.exe}
    RELEASE_EXTENSION=${RELEASE_EXTENSION:-.zip}
else
    TABBY_BINARY=${TABBY_BINARY:-tabby_x86_64-manylinux_2_28}
    RELEASE_EXTENSION=${RELEASE_EXTENSION:-.tar.gz}
fi

curl https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/${ZIP_FILE} -L -o ${ZIP_FILE}
unzip ${ZIP_FILE} -d ${OUTPUT_NAME}

pushd ${OUTPUT_NAME}
if [[ ${LLAMA_CPP_PLATFORM} == win* ]]; then
    rm $(ls *.exe | grep -v "llama-server")
    cp "../tabby_${TABBY_BINARY}" tabby

    popd
    zip -r ${OUTPUT_NAME}.zip ${OUTPUT_NAME}
else
    # upstream release linux package within build/bin directory
    mv build/bin/* .
    rm -r build

    rm $(ls . | grep -v -e "llama-server" -e '.so$' -e "LICENSE")
    chmod +x llama-server
    mv LICENSE LICENSE-llama-server
    cp ../tabby_${TABBY_BINARY} tabby

    popd
    tar -czvf ${OUTPUT_NAME}.tar.gz ${OUTPUT_NAME}
fi

rm -rf "${OUTPUT_NAME}"

mkdir -p dist
mv ${OUTPUT_NAME}.* dist/
