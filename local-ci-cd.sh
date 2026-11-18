#!/usr/bin/env bash
# ============================================================================
# EDMS Archive — Local CI/CD Pipeline (Windows x64 NSIS Package)
# ----------------------------------------------------------------------------
# Enforces the full release gate locally and builds ONLY the Windows x64 Setup
# installer (`EDMS-Archive-<version>-Setup-x64.exe`), then copies it to phone
# storage (`/sdcard/Download/`).
#
#   Stage 1 — Code sanity & linters
#       npm run typecheck
#       npm run lint
#   Stage 2 — Automated unit & migration safety test gate
#       npm test
#   Stage 3 — Windows x64 runtime & NSIS toolchain verification
#       Tesseract OCR runtime (tesseract.exe + DLLs + ara/eng/osd.traineddata)
#       Windows x64 N-API binaries (@libsql/win32-x64-msvc, @img/sharp-win32-x64)
#       NSIS + 7-Zip cross-packaging toolset
#   Stage 4 — Windows x64 NSIS Setup build & artifact verification
#       npm run electron:pack
#       Verify server.js, BUILD_ID, tesseract.exe, ara.traineddata, .node/.dll
#       Generate dist/release/SHA256SUMS.txt
#   Stage 5 — Copy Windows package to Phone Storage (/sdcard/Download)
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PHONE_DOWNLOAD_DIR="${PHONE_DOWNLOAD_DIR:-/sdcard/Download}"
export TESSERACT_SRC="${TESSERACT_SRC:-/tmp/tesseract-win64}"
export ELECTRON_BUILDER_NSIS_DIR="${ELECTRON_BUILDER_NSIS_DIR:-/tmp/eb-nsis}"
export ELECTRON_BUILDER_NSIS_RESOURCES_DIR="${ELECTRON_BUILDER_NSIS_RESOURCES_DIR:-/tmp/eb-nsis-resources}"
export ELECTRON_BUILDER_7ZIP_PATH="${ELECTRON_BUILDER_7ZIP_PATH:-/usr/bin/7za}"

PACKAGE_ONLY="false"
for arg in "$@"; do
    case "$arg" in
        --package-only) PACKAGE_ONLY="true" ;;
    esac
done

_C="\033[0;36m" _G="\033[0;32m" _R="\033[0;31m" _Y="\033[1;33m" _N="\033[0m"
info() { printf "${_C}[ci]${_N} %s\n" "$*"; }
ok()   { printf "${_G}[ok]${_N}  %s\n" "$*"; }
warn() { printf "${_Y}[warn]${_N} %s\n" "$*" >&2; }
fail() { printf "${_R}[fail]${_N} %s\n" "$*" >&2; }
step() { printf "\n${_C}==== %s ====${_N}\n" "$*"; }

CURRENT_STAGE="bootstrap"
trap 'fail "pipeline aborted during: ${CURRENT_STAGE}"' ERR
START_TS="$(date +%s)"

if [[ "$PACKAGE_ONLY" != "true" ]]; then
    # ---------------------------------------------------------------------------
    # Stage 1 — Code sanity & linters
    # ---------------------------------------------------------------------------
    CURRENT_STAGE="Stage 1 (typecheck & lint)"
    step "Stage 1/5 — Code sanity & linters"

    info "npm run typecheck"
    npm run typecheck
    ok "TypeScript typecheck clean"

    info "npm run lint"
    npm run lint
    ok "ESLint clean"

    # ---------------------------------------------------------------------------
    # Stage 2 — Automated unit & migration safety test gate
    # ---------------------------------------------------------------------------
    CURRENT_STAGE="Stage 2 (unit & migration tests)"
    step "Stage 2/5 — Automated unit & migration safety test gate"

    info "npm test"
    npm test
    ok "All Vitest suites passed (including upgrade-safety & migration-safety)"
fi

# ---------------------------------------------------------------------------
# Stage 3 — Windows x64 runtime & NSIS toolchain verification
# ---------------------------------------------------------------------------
CURRENT_STAGE="Stage 3 (Windows x64 toolchain & dependencies)"
step "Stage 3/5 — Windows x64 runtime & NSIS toolchain verification"

if [[ ! -f "$TESSERACT_SRC/tesseract.exe" || ! -f "$TESSERACT_SRC/tessdata/ara.traineddata" ]]; then
    fail "Windows x64 Tesseract runtime missing at $TESSERACT_SRC"
    exit 1
fi
ok "Tesseract OCR Windows x64 runtime verified at $TESSERACT_SRC"

if [[ ! -f "$ROOT/node_modules/@libsql/win32-x64-msvc/index.node" || ! -f "$ROOT/node_modules/@img/sharp-win32-x64/lib/libvips-42.dll" ]]; then
    info "Staging @libsql/win32-x64-msvc and @img/sharp-win32-x64 into node_modules..."
    TMP_NPM="$(mktemp -d)"
    (
        cd "$TMP_NPM"
        npm pack @libsql/win32-x64-msvc@0.5.29 @img/sharp-win32-x64@0.35.5
        mkdir -p "$ROOT/node_modules/@libsql/win32-x64-msvc" "$ROOT/node_modules/@img/sharp-win32-x64"
        tar -xzf libsql-win32-x64-msvc-0.5.29.tgz -C "$ROOT/node_modules/@libsql/win32-x64-msvc" --strip-components=1
        tar -xzf img-sharp-win32-x64-0.35.5.tgz -C "$ROOT/node_modules/@img/sharp-win32-x64" --strip-components=1
    )
    rm -rf "$TMP_NPM"
fi
ok "Windows x64 native N-API modules (@libsql/win32-x64-msvc, @img/sharp-win32-x64) verified"

if [[ ! -x "$ELECTRON_BUILDER_NSIS_DIR/linux/makensis" || ! -f "$ELECTRON_BUILDER_NSIS_DIR/elevate.exe" ]]; then
    fail "NSIS bundle missing at $ELECTRON_BUILDER_NSIS_DIR"
    exit 1
fi
ok "NSIS toolchain ($ELECTRON_BUILDER_NSIS_DIR) & 7za ($ELECTRON_BUILDER_7ZIP_PATH) verified"

# ---------------------------------------------------------------------------
# Stage 4 — Windows x64 NSIS Setup build & artifact verification
# ---------------------------------------------------------------------------
CURRENT_STAGE="Stage 4 (Windows x64 NSIS Setup build)"
step "Stage 4/5 — Windows x64 NSIS Setup build & artifact verification"

if [[ "$PACKAGE_ONLY" == "true" && -f "$ROOT/dist/standalone/server.js" && -f "$ROOT/dist/electron/main.cjs" ]]; then
    info "npx electron-builder --win nsis --x64 --publish never (reusing staged dist/standalone)"
    npx electron-builder --win nsis --x64 --publish never
else
    info "npm run electron:pack (Windows x64 NSIS only)"
    npm run electron:pack
fi
ok "electron:pack finished"

SETUP_EXE="$(ls "$ROOT"/dist/release/EDMS-Archive-*-Setup-x64.exe 2>/dev/null | head -n 1 || true)"
if [[ -z "$SETUP_EXE" || ! -f "$SETUP_EXE" ]]; then
    fail "Setup exe not found in dist/release/"
    exit 1
fi

SETUP_SIZE="$(stat -c%s "$SETUP_EXE")"
if (( SETUP_SIZE < 10485760 )); then
    fail "Installer suspiciously small: ${SETUP_SIZE} bytes"
    exit 1
fi

for req in \
    "dist/release/win-unpacked/resources/standalone/server.js" \
    "dist/release/win-unpacked/resources/standalone/.next/BUILD_ID" \
    "dist/release/win-unpacked/resources/tesseract/tesseract.exe" \
    "dist/release/win-unpacked/resources/tesseract/tessdata/ara.traineddata" \
    "dist/release/win-unpacked/resources/standalone/node_modules/@libsql/win32-x64-msvc/index.node" \
    "dist/release/win-unpacked/resources/standalone/node_modules/@img/sharp-win32-x64/lib/libvips-42.dll"; do
    if [[ ! -f "$ROOT/$req" ]]; then
        fail "Packaged runtime file missing: $req"
        exit 1
    fi
done
ok "All packaged Windows x64 runtime files verified"

(
    cd "$ROOT/dist/release"
    sha256sum "$(basename "$SETUP_EXE")" > SHA256SUMS.txt
)
info "SHA256SUMS.txt:"
cat "$ROOT/dist/release/SHA256SUMS.txt"

# ---------------------------------------------------------------------------
# Stage 5 — Copy to Phone Storage (/sdcard/Download)
# ---------------------------------------------------------------------------
CURRENT_STAGE="Stage 5 (Copy to Phone Storage)"
step "Stage 5/5 — Copy Windows package to Phone Storage ($PHONE_DOWNLOAD_DIR)"

if [[ -d "$PHONE_DOWNLOAD_DIR" ]]; then
    cp -f "$SETUP_EXE" "$PHONE_DOWNLOAD_DIR/"
    if [[ -f "${SETUP_EXE}.blockmap" ]]; then
        cp -f "${SETUP_EXE}.blockmap" "$PHONE_DOWNLOAD_DIR/"
    fi
    cp -f "$ROOT/dist/release/SHA256SUMS.txt" "$PHONE_DOWNLOAD_DIR/EDMS-Archive-SHA256SUMS.txt"
    ok "Copied $(basename "$SETUP_EXE") to $PHONE_DOWNLOAD_DIR/"
    ls -lh "$PHONE_DOWNLOAD_DIR/$(basename "$SETUP_EXE")" "$PHONE_DOWNLOAD_DIR/EDMS-Archive-SHA256SUMS.txt"
else
    warn "Phone storage directory $PHONE_DOWNLOAD_DIR not found; skipping copy"
fi

ELAPSED="$(( $(date +%s) - START_TS ))"
printf "\n${_G}%s${_N}\n" "=============================================="
ok "LOCAL CI/CD PIPELINE COMPLETE in ${ELAPSED}s"
printf "${_G}%s${_N}\n" "=============================================="
