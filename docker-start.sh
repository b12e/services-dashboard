#!/bin/sh

# Docker startup script for Services Dashboard
# Runs both the main app and admin panel

echo "====================================="
echo "Starting Services Dashboard"
echo "====================================="

# Start the main application server in the background
echo "Starting main application on port ${PORT}..."
node server/index.js &
MAIN_PID=$!

# Wait a moment for the main server to start
sleep 2

# Start the admin server in the background
echo "Starting admin panel on port ${ADMIN_PORT}..."
node admin-server.js &
ADMIN_PID=$!

echo "====================================="
echo "Both servers started successfully"
echo "Main app: http://localhost:${PORT}"
echo "Admin panel: http://localhost:${ADMIN_PORT}"
echo "====================================="

# Wait for both processes
wait $MAIN_PID $ADMIN_PID
