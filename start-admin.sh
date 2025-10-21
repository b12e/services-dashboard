#!/bin/bash

# Start script for Services Dashboard Management Tool

echo "Starting Services Dashboard Management Tool..."
echo ""
echo "This will start the management server on port 3001"
echo ""

# Check if admin-dist exists
if [ ! -d "admin-dist" ]; then
    echo "Admin UI not built yet. Building now..."
    npm run admin:build
    echo ""
fi

# Start the server
echo "Starting admin server..."
npm run admin:server
