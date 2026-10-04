#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================="
echo "   Starting Hourglass Cafe POS System     "
echo "      'Taste The Rhythm of Time'          "
echo "=========================================="
echo ""
echo "Cleaning existing port locks..."
node kill-ports.js 3001 3002 3003 2>/dev/null || true

echo ""
echo "Starting servers..."
echo "  • Public Web POS:       https://pos.15.207.179.83.nip.io"
echo "  • Public Customer Menu: https://pos.15.207.179.83.nip.io/order"
echo "  • Public Kitchen (KDS): https://pos.15.207.179.83.nip.io/kds"
echo "  • Public Waiter App:    https://pos.15.207.179.83.nip.io/server-standalone"
echo ""
echo "Local Internal Ports (on this server):"
echo "  • Local API & POS:      http://localhost:3001"
echo "  • Local KDS:            http://localhost:3002/kds"
echo "  • Local Waiter App:     http://localhost:3003/server-standalone"
echo ""
echo "Default Accounts:"
echo "  • Owner:   owner@hourglasscafe.com   | Password: Password123! | PIN: 1130"
echo "  • Manager: manager@hourglasscafe.com | Password: Password123! | PIN: 1131"
echo "  • Cashier: cashier@hourglasscafe.com | Password: Password123! | PIN: 1234"
echo "  • Chef:    chef@hourglasscafe.com    | Password: Password123! | PIN: 5678"
echo "=========================================="
echo ""
exec node dev-server.js
