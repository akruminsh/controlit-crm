#!/bin/bash
# Controlit CRM Update Script
# Run this on the VPS to pull the latest image and restart app services safely.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/controlit-crm}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
ENV_FILE=".env"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_POLL_SECONDS="${HEALTH_POLL_SECONDS:-5}"

resolve_compose_file() {
  if [[ -n "${COMPOSE_FILE}" ]]; then
    if [[ ! -f "${COMPOSE_FILE}" ]]; then
      echo "ERROR: COMPOSE_FILE=${COMPOSE_FILE} does not exist in ${DEPLOY_DIR}." >&2
      exit 1
    fi
    return
  fi

  if [[ -f "docker-compose.prod.yml" ]]; then
    COMPOSE_FILE="docker-compose.prod.yml"
  elif [[ -f "docker-compose.yml" ]]; then
    COMPOSE_FILE="docker-compose.yml"
  else
    echo "ERROR: No docker-compose.prod.yml or docker-compose.yml found in ${DEPLOY_DIR}." >&2
    exit 1
  fi
}

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

run_upgrade_command() {
  compose run --rm -T \
    -e DISABLE_DB_MIGRATIONS=true \
    -e DISABLE_CRON_JOBS_REGISTRATION=true \
    server yarn command:prod "$@"
}

run_database_migration() {
  compose run --rm -T \
    -e DISABLE_DB_MIGRATIONS=true \
    -e DISABLE_CRON_JOBS_REGISTRATION=true \
    server yarn database:migrate:prod --force --include-slow
}

read_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  printf '%s' "${line#*=}"
}

validate_database_password() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "No ${ENV_FILE} file found; assuming the compose file defines database connection settings directly."
    return
  fi

  local pg_password
  pg_password="$(read_env_value "PG_DATABASE_PASSWORD")"

  if [[ -z "${pg_password}" ]]; then
    echo "PG_DATABASE_PASSWORD is not set in ${ENV_FILE}; assuming the compose file defines PG_DATABASE_URL directly."
    return
  fi

  if [[ "${pg_password}" == CHANGE_ME* ]]; then
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
    local container_id
    container_id="$(compose ps -q server)"

    if [[ -z "${container_id}" ]]; then
      echo "ERROR: Server container is missing after rollout start." >&2
      print_status_and_logs
      return 1
    fi

    local state_status
    state_status="$(docker inspect --format '{{.State.Status}}' "${container_id}" 2>/dev/null || true)"

    case "${state_status}" in
      exited | dead | removing)
        echo "ERROR: Server reached terminal state: ${state_status}." >&2
        print_status_and_logs
        return 1
        ;;
    esac

    local health_status
    health_status="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \
        "${container_id}" 2>/dev/null || true
    )"

    if [[ "${health_status}" == "healthy" ]]; then
      echo "Server is healthy."
      return 0
    fi

    if [[ "${health_status}" == "no-healthcheck" && "${state_status}" == "running" ]]; then
      echo "Server is running without a healthcheck."
      return 0
    fi

    echo "Waiting for server health: state=${state_status:-unknown}, health=${health_status:-unknown}..."

    sleep "${HEALTH_POLL_SECONDS}"
  done

  echo "ERROR: Server did not become healthy within ${HEALTH_TIMEOUT_SECONDS} seconds." >&2
  print_status_and_logs
  return 1
}

cd "${DEPLOY_DIR}"
resolve_compose_file
validate_database_password

echo "Using compose file: ${COMPOSE_FILE}"
echo "Pulling latest Controlit CRM server and worker images..."
compose pull server worker

echo "Ensuring database and Redis are running for the upgrade..."
compose up -d db redis

echo "Stopping app services before explicit upgrade..."
compose stop worker server

echo "Running database migrations..."
run_database_migration

echo "Flushing cache before upgrade..."
run_upgrade_command cache:flush

echo "Running upgrade dry run..."
run_upgrade_command upgrade --dry-run

echo "Applying upgrade..."
run_upgrade_command upgrade

echo "Flushing cache after upgrade..."
run_upgrade_command cache:flush

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
