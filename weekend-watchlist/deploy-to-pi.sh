#!/bin/bash

# Deploy Weekend Watchlist to Raspberry Pi (Docker + Tunnel)

set -e

# Interactive Setup
echo "========================================"
echo "  Weekend Watchlist Deployment (Prod)"
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
echo "Target: $PI_HOST"
echo "----------------------------------------"
read -p "Press Enter to start deployment (or Ctrl+C to cancel)..."

echo ""
echo "=== 1. Building app locally ==="
npm run build

echo ""
echo "=== 2. Preparing files on Pi ==="
# Create a clean directory in the user's home folder
ssh "$PI_HOST" "mkdir -p ~/$REMOTE_BASE"

# Copy the build files and config
echo "Copying web files and config..."
scp -r dist "$PI_HOST:~/$REMOTE_BASE/"
scp nginx.docker.conf "$PI_HOST:~/$REMOTE_BASE/"
scp docker-compose.prod.yml "$PI_HOST:~/$REMOTE_BASE/docker-compose.yml"

echo ""
echo "=== 3. Launching Docker Stack on Pi ==="
ssh "$PI_HOST" << EOF
    cd ~/$REMOTE_BASE
    
    # Take down old containers and remove conflicting ones by name (Aggressive Cleanup)
    docker compose down --remove-orphans || true
    docker rm -f weekend_watchlist_web weekend_watchlist_tunnel || true

    # Start the stack
    echo "Starting services..."
    docker compose up -d
EOF

echo ""
echo "============================================"
echo "  SUCCESS! The stack is running."
echo ""
echo "  To get your public Tunnel URL, run this on your Pi:"
echo "  ssh $PI_HOST 'docker logs weekend_watchlist_tunnel 2>&1 | grep trycloudflare.com'"
echo "============================================"