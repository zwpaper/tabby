#!/bin/bash

# Convert Parts Script
# Converts string-based content to structured Part arrays in JSONL/JSON files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONVERT_SCRIPT="$SCRIPT_DIR/convert-parts.js"

# Check if convert script exists
if [ ! -f "$CONVERT_SCRIPT" ]; then
    print_error "Convert script not found: $CONVERT_SCRIPT"
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 <input-file> [output-file]"
    echo ""
    echo "Convert string-based content to structured Part arrays"
    echo ""
    echo "Arguments:"
    echo "  input-file   Input .json or .jsonl file to convert"
    echo "  output-file  Output file (optional, defaults to input-converted.ext)"
    echo ""
    echo "Examples:"
    echo "  $0 label.jsonl"
    echo "  $0 label.jsonl label-parts.jsonl"
    echo "  $0 data.json data-converted.json"
}

# Check arguments
if [ $# -lt 1 ]; then
    print_error "Missing required argument: input-file"
    echo ""
    show_usage
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    print_error "Input file does not exist: $INPUT_FILE"
    exit 1
fi

# Check file extension
if [[ ! "$INPUT_FILE" =~ \.(json|jsonl)$ ]]; then
    print_error "Input file must have .json or .jsonl extension"
    exit 1
fi

# Generate output filename if not provided
if [ -z "$OUTPUT_FILE" ]; then
    if [[ "$INPUT_FILE" =~ \.jsonl$ ]]; then
        OUTPUT_FILE="${INPUT_FILE%.jsonl}-converted.jsonl"
    else
        OUTPUT_FILE="${INPUT_FILE%.json}-converted.json"
    fi
fi

print_info "Starting conversion..."
print_info "Input file: $INPUT_FILE"
print_info "Output file: $OUTPUT_FILE"
echo ""

# Run the conversion
if node "$CONVERT_SCRIPT" "$INPUT_FILE" "$OUTPUT_FILE"; then
    echo ""
    print_info "Conversion completed successfully!"
    
    # Show file sizes
    if command -v wc &> /dev/null && command -v du &> /dev/null; then
        INPUT_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
        OUTPUT_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        
        if [[ "$INPUT_FILE" =~ \.jsonl$ ]]; then
            INPUT_LINES=$(wc -l < "$INPUT_FILE")
            OUTPUT_LINES=$(wc -l < "$OUTPUT_FILE")
            echo "Input:  $INPUT_LINES lines, $INPUT_SIZE"
            echo "Output: $OUTPUT_LINES lines, $OUTPUT_SIZE"
        else
            echo "Input:  $INPUT_SIZE"
            echo "Output: $OUTPUT_SIZE"
        fi
    fi
else
    print_error "Conversion failed!"
    exit 1
fi