#!/bin/sh

# Docker entrypoint: the dashboard and the admin panel run in one Node
# process, so stop signals reach it directly and a crash stops the container.
exec node server/start.js
