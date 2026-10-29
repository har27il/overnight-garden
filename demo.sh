#!/usr/bin/env bash
# Overnight Garden demo: the real install, hooks, engine and status line, run in a
# throwaway home folder. Only the clock is simulated. Every line it prints is a check.
set -euo pipefail
cd "$(dirname "$0")"
exec node scripts/demo.js "$@"
