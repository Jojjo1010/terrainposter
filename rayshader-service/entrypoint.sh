#!/bin/bash
set -e

# Start Xvfb
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
export DISPLAY=:99

# Wait for Xvfb to be ready
sleep 1

# Start the R plumber API
exec Rscript /app/start.R
