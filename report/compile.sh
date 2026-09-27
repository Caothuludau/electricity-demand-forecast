#!/usr/bin/env bash
# Build the report. Usage: bash compile.sh [jobname]
set -euo pipefail
cd "$(dirname "$0")"
JOB="${1:-main}"
echo "==> Compiling ${JOB}.tex"
pdflatex -interaction=nonstopmode -halt-on-error -file-line-error "$JOB" > /dev/null
pdflatex -interaction=nonstopmode -halt-on-error -file-line-error "$JOB" > /dev/null
pdflatex -interaction=nonstopmode -halt-on-error -file-line-error "$JOB" > /dev/null
echo "==> ${JOB}.pdf built"
