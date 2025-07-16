#!/bin/bash

# A script to generate an Ed25519 key pair and output it in Base64URL format.

set -euo pipefail

# 1. Create a temporary file to hold the PEM-formatted private key.
# A trap ensures the file is deleted when the script exits.
PEM_FILE=$(mktemp)
trap 'rm -f "$PEM_FILE"' EXIT

# 2. Generate the Ed25519 private key using openssl.
openssl genpkey -algorithm Ed25519 -out "$PEM_FILE" 2>/dev/null

# 3. Extract the raw 32-byte private key seed.
PRIVATE_KEY_RAW=$(openssl pkey -in "$PEM_FILE" -outform DER | tail -c 32)

# 4. Extract the raw 32-byte public key.
PUBLIC_KEY_RAW=$(openssl pkey -in "$PEM_FILE" -pubout -outform DER | tail -c 32)

# 5. Convert the raw keys to Base64URL format.
# This involves replacing '+' with '-', '/' with '_', and removing padding '='.
PRIVATE_KEY_B64URL=$(echo -n "$PRIVATE_KEY_RAW" | base64 | tr '/+' '_-' | tr -d '=')
PUBLIC_KEY_B64URL=$(echo -n "$PUBLIC_KEY_RAW" | base64 | tr '/+' '_-' | tr -d '=')

# 6. Output the keys in a clean JSON format.
echo "private_key_base64url: $PRIVATE_KEY_B64URL"
echo "public_key_base64url: $PUBLIC_KEY_B64URL"
