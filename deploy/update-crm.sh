#!/bin/bash
# Controlit CRM Update Script
# Run this on the VPS to pull the latest image and restart app services safely.

set -euo pipefail

DEPLOY_DIR="/opt/controlit-crm"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_POLL_SECONDS="${HEALTH_POLL_SECONDS:-5}"

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

read_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  printf '%s' "${line#*=}"
}

validate_database_password() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: ${ENV_FILE} is missing in ${DEPLOY_DIR}." >&2
    exit 1
  fi

  local pg_password
  pg_password="$(read_env_value "PG_DATABASE_PASSWORD")"

  if [[ -z "${pg_password}" || "${pg_password}" == CHANGE_ME* ]]; then
    echo "ERROR: PG_DATABASE_PASSWORD must be set before updating Controlit CRM." >&2
    exit 1
  fi

  if [[ ! "${pg_password}" =~ ^[A-Za-z0-9._~-]+$ ]]; then
    echo "ERROR: PG_DATABASE_PASSWORD contains characters that are unsafe in PG_DATABASE_URL." >&2
    echo "Use only letters, numbers, dot, underscore, hyphen, and tilde; the password was not printed." >&2
    exit 1
  fi
}

print_status_and_logs() {
  echo ""
  echo "Container status:"
  compose ps || true
  echo ""
  echo "Recent server logs:"
  compose logs --tail=120 server || true
}

wait_for_server_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  while ((SECONDS < deadline)); do
    local server_container_id
    server_container_id="$(compose ps -q server)"

    if [[ -n "${server_container_id}" ]]; then
      local health_status
      health_status="$(
        docker inspect \
          -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
          "${server_container_id}" 2>/dev/null || true
      )"

      case "${health_status}" in
        healthy)
          echo "Server is healthy."
          return 0
          ;;
        exited | dead)
          echo "ERROR: Server reached terminal state: ${health_status}." >&2
          print_status_and_logs
          return 1
          ;;
        unhealthy)
          echo "Waiting for server health: unhealthy..."
          ;;
        *)
          echo "Waiting for server health: ${health_status:-unknown}..."
          ;;
      esac
    else
      echo "Waiting for server container to be created..."
    fi

    sleep "${HEALTH_POLL_SECONDS}"
  done

  echo "ERROR: Server did not become healthy within ${HEALTH_TIMEOUT_SECONDS} seconds." >&2
  print_status_and_logs
  return 1
}

cd "${DEPLOY_DIR}"
validate_database_password

echo "Pulling latest Controlit CRM server and worker images..."
compose pull server worker

echo "Stopping worker before rollout..."
compose stop worker

echo "Starting server..."
compose up -d server

echo "Waiting for server health check..."
wait_for_server_health

echo "Starting worker..."
compose up -d worker

echo "Checking container status..."
compose ps

echo ""
echo "Update complete."
echo "Visit: https://crm.controlitfactory.eu"
