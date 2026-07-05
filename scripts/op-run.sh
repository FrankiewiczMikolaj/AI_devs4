#!/usr/bin/env bash
set -euo pipefail
: "${OP_ENVIRONMENT:?Set OP_ENVIRONMENT in mise.local.toml before running :op scripts}"
exec op run --environment "$OP_ENVIRONMENT" -- "$@"
