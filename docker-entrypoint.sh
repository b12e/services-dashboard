#!/bin/bash

# Set strict error handling
set -e

# Function to check if a file exists and is readable
check_file() {
    local file_path="$1"
    local file_name="$2"
    
    if [[ ! -f "$file_path" ]]; then
        echo "ERROR: Required file '$file_name' not found at $file_path"
        echo "Please mount this file using Docker volumes:"
        echo "  -v /path/to/your/$file_name:/usr/share/nginx/html/$file_name:ro"
        exit 1
    fi
    
    if [[ ! -r "$file_path" ]]; then
        echo "ERROR: Required file '$file_name' exists but is not readable at $file_path"
        echo "Please check file permissions and ensure the file is readable"
        exit 1
    fi
    
    echo "✓ Found and verified $file_name"
}

# Check for required configuration files
echo "Checking for required configuration files..."
check_file "/usr/share/nginx/html/services.json" "services.json"
check_file "/usr/share/nginx/html/configuration.json" "configuration.json"

echo "All required files found. Starting nginx..."
echo "Dashboard will be available at http://localhost:80"

# Start nginx in foreground
exec nginx -g "daemon off;"
