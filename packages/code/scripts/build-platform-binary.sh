
clean() {
    rm -rf dist
}

build() {
    local target=$1
    local platform=$2
    local ext=$3
    bun run build -- --target=$target --outfile=./dist/$platform/ragdoll-code
    # generate .tar.gz for linux and mac, generate .zip for windows
    if [ "$platform" == "windows-x64" ]; then
        zip -r ./dist/ragdoll-code-$platform.zip -j ./dist/$platform/*
    else
        tar -czvf ./dist/ragdoll-code-$platform.tar.gz -C ./dist/$platform .
    fi
    rm -rf ./dist/$platform
}

clean
build bun-mac-arm64 mac-arm64
build bun-linux-x64 linux-x64
build bun-windows-x64 windows-x64 .exe