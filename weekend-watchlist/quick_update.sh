#!/bin/bash

# Quick Update for Weekend Watchlist
# Updates code WITHOUT killing the Cloudflare Tunnel

set -e

# Interactive Setup
echo "========================================"
echo "  Weekend Watchlist: Quick Code Update"
echo "  (Preserves Tunnel URL)"
echo "========================================"
echo ""

# Ensure we are in the project directory
cd "$(dirname "$0")"

# Ask for Username
read -p "Enter Raspberry Pi username (default: max): " PI_USER
PI_USER=${PI_USER:-max}

# Ask for Hostname or IP
read -p "Enter Raspberry Pi IP or Hostname (default: 192.168.1.254): " PI_ADDRESS
PI_ADDRESS=${PI_ADDRESS:-192.168.1.254}

PI_HOST="$PI_USER@$PI_ADDRESS"
REMOTE_BASE="weekend-watchlist-deploy"

echo ""
echo "=== 1. Building app locally ==="
npm run build

echo ""
echo "=== 2. Uploading New Code ==="
# Copy the build files and config
echo "Copying web files..."
scp -r dist "$PI_HOST:~/$REMOTE_BASE/"
scp nginx.docker.conf "$PI_HOST:~/$REMOTE_BASE/"

echo ""
echo "=== 3. Refreshing App Container ==="
ssh "$PI_HOST" << EOF
    cd ~/$REMOTE_BASE
    
    # Rebuild and restart ONLY the web service
    echo "Swapping out application code..."
    docker compose up -d --no-deps --build web
EOF

echo ""
echo "============================================"
echo "  SUCCESS! Code updated."
echo "  Your Tunnel URL should still be active."
echo "============================================"
