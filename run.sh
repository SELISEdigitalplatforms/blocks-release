#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CLIENT_DIR="$SCRIPT_DIR/client"
E2E_DIR="$SCRIPT_DIR/e2e"
API_PROJECT="$SCRIPT_DIR/server/Api/Api.csproj"
WORKER_PROJECT="$SCRIPT_DIR/server/Worker/Worker.csproj"
WWWROOT_DIR="$SCRIPT_DIR/server/Api/wwwroot"

API_PORT=5000
FRONTEND_PORT=4000

# Ensure SSL vars are explicitly in scope for Vite
export RELEASE_SSL_CERT="${RELEASE_SSL_CERT:-}"
export RELEASE_SSL_KEY="${RELEASE_SSL_KEY:-}"

API_PID=""
WORKER_PID=""

usage() {
cat <<EOF
Usage: $0 [OPTION]

Options:
  -a, --all         Build frontend + run API + Worker
  -b, --backend     Run .NET API
  -w, --worker      Run .NET Worker
  -f, --frontend    Run frontend dev server
  -k, --kill-port   Kill API port ($API_PORT)
  -n, --npm         Run npm command inside client/
  -h, --help        Show help

Tests:
  -te, --test-e2e   End-to-end tests (e2e/: playwright)

Examples:
  $0 -a
  $0 -b
  $0 -f
  $0 -k
  $0 -te
EOF
exit 1
}

# ---------- PORT CLEANUP ----------
free_port() {
    local PORT=$1

    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids="$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)"

        if [ -n "$pids" ]; then
            echo "Port $PORT in use by: $pids — killing..."
            for pid in $pids; do
                kill "$pid" 2>/dev/null || true
            done
            sleep 1
        fi
    else
        local pids
        pids="$(netstat -ano 2>/dev/null | grep ":$PORT" | awk '{print $5}' | sort -u || true)"

        if [ -n "$pids" ]; then
            echo "Port $PORT in use by: $pids — killing..."
            for pid in $pids; do
                taskkill //PID "$pid" //F >/dev/null 2>&1 || true
            done
        fi
    fi
}

# ---------- CLEANUP ----------
cleanup() {
    echo "Shutting down..."

    [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
    [ -n "${WORKER_PID:-}" ] && kill "$WORKER_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# ---------- FRONTEND ----------
run_frontend() {
    echo "Starting frontend..."

    if [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo "Installing dependencies..."
        (cd "$CLIENT_DIR" && npm clean-install)
    fi

    free_port $FRONTEND_PORT

    cd "$CLIENT_DIR" && npm run dev
}

build_frontend() {
    echo "Building frontend..."

    pushd "$CLIENT_DIR" > /dev/null
    npm install
    npm run build
    popd > /dev/null

    mkdir -p "$WWWROOT_DIR"

    if [ -d "$CLIENT_DIR/dist" ]; then
        echo "Syncing dist → wwwroot..."
        if command -v rsync >/dev/null 2>&1; then
            rsync -a --delete "$CLIENT_DIR/dist/" "$WWWROOT_DIR/"
        else
            rm -rf "$WWWROOT_DIR"/*
            cp -r "$CLIENT_DIR/dist/"* "$WWWROOT_DIR/"
        fi
    fi
}

# ---------- BACKEND ----------
# HTTPS is driven by the machine env vars RELEASE_SSL_CERT / RELEASE_SSL_KEY.
# Both set + both files present -> HTTPS on $API_PORT; otherwise -> HTTP (fallback).
configure_backend_tls() {
    if [ -n "${RELEASE_SSL_CERT:-}" ] && [ -n "${RELEASE_SSL_KEY:-}" ] \
       && [ -f "$RELEASE_SSL_CERT" ] && [ -f "$RELEASE_SSL_KEY" ]; then
        export Kestrel__Certificates__Default__Path="$RELEASE_SSL_CERT"
        export Kestrel__Certificates__Default__KeyPath="$RELEASE_SSL_KEY"
        export ASPNETCORE_URLS="https://0.0.0.0:$API_PORT"
        echo "Backend TLS: HTTPS on $API_PORT"
    else
        export ASPNETCORE_URLS="http://0.0.0.0:$API_PORT"
        echo "Backend TLS: cert env not set/found — HTTP on $API_PORT"
    fi
}

run_backend() {
    configure_backend_tls
    echo "Running .NET API on port $API_PORT..."
    # Pass the URL on the command line: it has higher precedence than the
    # launchSettings.json applicationUrl, which would otherwise override
    # the ASPNETCORE_URLS we exported above.
    dotnet run --project "$API_PROJECT" -- --urls "$ASPNETCORE_URLS"
}

run_worker() {
    echo "Running .NET Worker..."
    dotnet run --project "$WORKER_PROJECT"
}

# ---------- TESTS ----------
ensure_node_modules() {
    local dir=$1
    if [ ! -d "$dir/node_modules" ]; then
        echo "Installing dependencies in $(basename "$dir")..."
        (cd "$dir" && npm install)
    fi
}

# Reads e2e/.env.e2e for the target host + credentials. Against the remote dev
# host that file sets E2E_NO_WEBSERVER=1; without it Playwright would try to
# start a local API itself (webServer: run.sh -b).
test_e2e() {
    echo "=== E2E tests ==="

    if [ ! -f "$E2E_DIR/.env.e2e" ]; then
        echo "Missing $E2E_DIR/.env.e2e — copy .env.e2e.example and set E2E_BASE_URL + credentials."
        exit 1
    fi

    ensure_node_modules "$E2E_DIR"

    (cd "$E2E_DIR" && npx playwright install --no-shell chromium)
    (cd "$E2E_DIR" && npm run test)
}

# ---------- MAIN ----------
if [ $# -eq 0 ]; then
    usage
fi

case "$1" in

    -k|--kill-port)
        free_port $API_PORT
        echo "Port $API_PORT cleared."
        ;;

    -f|--frontend)
        run_frontend
        ;;

    -b|--backend)
        free_port $API_PORT
        (cd "$SCRIPT_DIR" && run_backend) &
        API_PID=$!
        wait $API_PID
        ;;

    -w|--worker)
        (cd "$SCRIPT_DIR" && run_worker)
        ;;

    -a|--all)
        free_port $API_PORT

        build_frontend

        echo "Starting services..."

        (cd "$SCRIPT_DIR" && run_backend) &
        API_PID=$!

        (cd "$SCRIPT_DIR" && run_worker) &
        WORKER_PID=$!

        wait $API_PID $WORKER_PID
        ;;

    -te|--test-e2e)
        test_e2e
        ;;

    -n|--npm)
        shift
        [ $# -eq 0 ] && echo "Usage: $0 -n <args>" && exit 1
        (cd "$CLIENT_DIR" && npm "$@")
        ;;

    -h|--help)
        usage
        ;;

    *)
        usage
        ;;

esac
