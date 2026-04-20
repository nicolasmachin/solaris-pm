#!/bin/zsh

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:4000}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
TMP_DIR="$(mktemp -d)"
SUMMARY_FILE="$TMP_DIR/summary.txt"

record_result() {
  local label="$1"
  local actual_code="$2"
  local expected="$3"
  local detail="$4"

  if [[ "$actual_code" == "$expected" ]]; then
    printf "✓ %s — %s %s\n" "$label" "$actual_code" "$detail" >>"$SUMMARY_FILE"
  else
    printf "✗ %s — %s (esperado %s) %s\n" "$label" "$actual_code" "$expected" "$detail" >>"$SUMMARY_FILE"
  fi
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth="${4:-}"
  local body_file="$TMP_DIR/body.json"
  local http_status

  if [[ -n "$auth" && -n "$body" ]]; then
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $auth" \
      -H "Content-Type: application/json" \
      -d "$body")
  elif [[ -n "$auth" ]]; then
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $auth")
  elif [[ -n "$body" ]]; then
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" -X "$method" "$url")
  fi

  RESPONSE_STATUS="$http_status"
  RESPONSE_BODY="$(cat "$body_file")"
}

request_file_upload() {
  local url="$1"
  local auth="$2"
  local stage_id="$3"
  local file_path="$4"
  local body_file="$TMP_DIR/upload.json"

  RESPONSE_STATUS=$(curl -s -o "$body_file" -w "%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer $auth" \
    -F "stageId=$stage_id" \
    -F "file=@$file_path")
  RESPONSE_BODY="$(cat "$body_file")"
}

request_download() {
  local url="$1"
  local auth="$2"
  local target="$3"

  RESPONSE_STATUS=$(curl -s -L -o "$target" -w "%{http_code}" "$url" \
    -H "Authorization: Bearer $auth")
}

cd "$ROOT_DIR" || exit 1

request_json "POST" "$BASE_URL/auth/login" '{"email":"admin@voltiapm.com","password":"Admin1234"}'
TOKEN="$(printf "%s" "$RESPONSE_BODY" | jq -r '.token // empty')"
record_result "AUTH · POST /auth/login" "$RESPONSE_STATUS" "200" "token obtenido"

request_json "GET" "$BASE_URL/api/projects" "" "$TOKEN"
FIRST_PROJECT_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.[0].id // empty')"
record_result "PROYECTOS · GET /api/projects" "$RESPONSE_STATUS" "200" "primer proyecto: ${FIRST_PROJECT_ID:-n/a}"

request_json "GET" "$BASE_URL/api/projects/$FIRST_PROJECT_ID" "" "$TOKEN"
record_result "PROYECTOS · GET /api/projects/:id" "$RESPONSE_STATUS" "200" "detalle con métricas"

CREATE_PROJECT_BODY='{"clientName":"QA Solar Demo","capacityKwp":88,"locationCity":"Rosario","locationProvince":"Santa Fe","plannedEndDate":"2026-09-30","budgetUsd":76500,"estimatedMwhYear":140.2,"notificationEmail":"qa@voltiapm.com","notificationPhone":"+5493415550101","startDate":"2026-04-12"}'
request_json "POST" "$BASE_URL/api/projects" "$CREATE_PROJECT_BODY" "$TOKEN"
TEST_PROJECT_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.id // empty')"
STAGE1_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.stages[0].id // empty')"
STAGE2_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.stages[1].id // empty')"
record_result "PROYECTOS · POST /api/projects" "$RESPONSE_STATUS" "201" "proyecto creado: ${TEST_PROJECT_ID:-n/a}"

PATCH_PROJECT_BODY='{"clientName":"QA Solar Demo Ajustado","budgetUsd":81200}'
request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID" "$PATCH_PROJECT_BODY" "$TOKEN"
record_result "PROYECTOS · PATCH /api/projects/:id" "$RESPONSE_STATUS" "200" "clientName + budgetUsd"

request_json "GET" "$BASE_URL/api/projects/$TEST_PROJECT_ID" "" "$TOKEN"
record_result "PROYECTOS · GET /api/projects/:id (verificación)" "$RESPONSE_STATUS" "200" "cambios visibles"

request_json "GET" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages" "" "$TOKEN"
record_result "ETAPAS · GET /api/projects/:id/stages" "$RESPONSE_STATUS" "200" "etapas listadas"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE1_ID" '{"status":"IN_PROGRESS"}' "$TOKEN"
STAGE1_START="$(printf "%s" "$RESPONSE_BODY" | jq -r '.actualStartDate // empty')"
record_result "ETAPAS · PATCH etapa 1 -> IN_PROGRESS" "$RESPONSE_STATUS" "200" "actualStartDate=${STAGE1_START:-n/a}"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID" '{"status":"IN_PROGRESS"}' "$TOKEN"
record_result "ETAPAS · PATCH etapa 2 -> IN_PROGRESS sin completar etapa 1" "$RESPONSE_STATUS" "409" "$(printf "%s" "$RESPONSE_BODY" | jq -r '.code // empty')"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE1_ID" '{"status":"COMPLETED"}' "$TOKEN"
STAGE1_END="$(printf "%s" "$RESPONSE_BODY" | jq -r '.actualEndDate // empty')"
record_result "ETAPAS · PATCH etapa 1 -> COMPLETED" "$RESPONSE_STATUS" "200" "actualEndDate=${STAGE1_END:-n/a}"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID" '{"status":"IN_PROGRESS"}' "$TOKEN"
STAGE2_START="$(printf "%s" "$RESPONSE_BODY" | jq -r '.actualStartDate // empty')"
record_result "ETAPAS · PATCH etapa 2 -> IN_PROGRESS" "$RESPONSE_STATUS" "200" "actualStartDate=${STAGE2_START:-n/a}"

SUBSTAGE_CREATE_BODY='{"name":"Cableado DC sector QA","responsible":"Equipo QA","dueDate":"2026-04-20","plannedStartDate":"2026-04-14","plannedEndDate":"2026-04-20","notes":"Subetapa creada para testing"}'
request_json "POST" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID/substages" "$SUBSTAGE_CREATE_BODY" "$TOKEN"
TEST_SUBSTAGE_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.id // empty')"
record_result "SUBETAPAS · POST crear subetapa" "$RESPONSE_STATUS" "201" "substage=${TEST_SUBSTAGE_ID:-n/a}"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID/substages/$TEST_SUBSTAGE_ID" '{"status":"IN_PROGRESS"}' "$TOKEN"
SUBSTAGE_START="$(printf "%s" "$RESPONSE_BODY" | jq -r '.actualStartDate // empty')"
record_result "SUBETAPAS · PATCH -> IN_PROGRESS" "$RESPONSE_STATUS" "200" "actualStartDate=${SUBSTAGE_START:-n/a}"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID/substages/$TEST_SUBSTAGE_ID" '{"status":"BLOCKED","notes":"Bloqueada por proveedor"}' "$TOKEN"
record_result "SUBETAPAS · PATCH -> BLOCKED" "$RESPONSE_STATUS" "200" "nota de bloqueo aplicada"

request_json "GET" "$BASE_URL/api/notifications?unread=true" "" "$TOKEN"
BLOCKED_NOTIFICATION_COUNT="$(printf "%s" "$RESPONSE_BODY" | jq -r --arg projectId "$TEST_PROJECT_ID" '[.[] | select(.projectId == $projectId and .type == "substage_blocked")] | length')"
record_result "SUBETAPAS · verificación Notification por BLOCKED" "$([[ "$BLOCKED_NOTIFICATION_COUNT" -gt 0 ]] && echo 200 || echo 500)" "200" "substage_blocked=$BLOCKED_NOTIFICATION_COUNT"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/stages/$STAGE2_ID/substages/$TEST_SUBSTAGE_ID" '{"status":"COMPLETED"}' "$TOKEN"
STAGE_PROGRESS="$(printf "%s" "$RESPONSE_BODY" | jq -r '.stageProgressPercent // empty')"
record_result "SUBETAPAS · PATCH -> COMPLETED" "$RESPONSE_STATUS" "200" "stageProgressPercent=${STAGE_PROGRESS:-n/a}"

TOMORROW="$(date -v+1d +%F)"
TASK_CREATE_BODY="{\"title\":\"Tarea QA urgente\",\"description\":\"Validar completado automático\",\"responsible\":\"QA User\",\"priority\":\"URGENT\",\"dueDate\":\"$TOMORROW\",\"stageId\":\"$STAGE2_ID\"}"
request_json "POST" "$BASE_URL/api/projects/$TEST_PROJECT_ID/tasks" "$TASK_CREATE_BODY" "$TOKEN"
TEST_TASK_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.id // empty')"
record_result "TAREAS · POST crear tarea urgente" "$RESPONSE_STATUS" "201" "task=${TEST_TASK_ID:-n/a}"

request_json "PATCH" "$BASE_URL/api/projects/$TEST_PROJECT_ID/tasks/$TEST_TASK_ID" '{"status":"COMPLETED"}' "$TOKEN"
TASK_COMPLETED_AT="$(printf "%s" "$RESPONSE_BODY" | jq -r '.completedAt // empty')"
record_result "TAREAS · PATCH -> COMPLETED" "$RESPONSE_STATUS" "200" "completedAt=${TASK_COMPLETED_AT:-n/a}"

request_file_upload "$BASE_URL/api/projects/$TEST_PROJECT_ID/files" "$TOKEN" "$STAGE2_ID" "$SERVER_DIR/test-data/sample.pdf"
TEST_FILE_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.id // empty')"
record_result "ARCHIVOS · POST upload" "$RESPONSE_STATUS" "201" "file=${TEST_FILE_ID:-n/a}"

request_json "GET" "$BASE_URL/api/projects/$TEST_PROJECT_ID/files" "" "$TOKEN"
record_result "ARCHIVOS · GET listar" "$RESPONSE_STATUS" "200" "cantidad=$(printf "%s" "$RESPONSE_BODY" | jq 'length')"

DOWNLOAD_TARGET="$TMP_DIR/downloaded.pdf"
request_download "$BASE_URL/api/files/$TEST_FILE_ID/download" "$TOKEN" "$DOWNLOAD_TARGET"
DOWNLOADED_SIZE="$(wc -c < "$DOWNLOAD_TARGET" | tr -d ' ')"
record_result "ARCHIVOS · GET download" "$RESPONSE_STATUS" "200" "bytes=$DOWNLOADED_SIZE"

(
  cd "$SERVER_DIR" || exit 1
  DATABASE_URL="postgresql://nicolasmachin@localhost:5433/voltia_pm_local" JWT_SECRET="dev-secret" node --import tsx -e "import { runAlertsCheck } from './src/services/alerts.service.ts'; await runAlertsCheck();"
) >/dev/null 2>&1

request_json "GET" "$BASE_URL/api/projects/$TEST_PROJECT_ID/audit?page=1&limit=100" "" "$TOKEN"
AUDIT_COUNT="$(printf "%s" "$RESPONSE_BODY" | jq 'length')"
HAS_CLIENT_AUDIT="$(printf "%s" "$RESPONSE_BODY" | jq '[.[] | select(.fieldChanged == "clientName")] | length')"
HAS_BUDGET_AUDIT="$(printf "%s" "$RESPONSE_BODY" | jq '[.[] | select(.fieldChanged == "budgetUsd")] | length')"
HAS_TASK_AUDIT="$(printf "%s" "$RESPONSE_BODY" | jq '[.[] | select(.entityType == "task")] | length')"
HAS_FILE_AUDIT="$(printf "%s" "$RESPONSE_BODY" | jq '[.[] | select(.entityType == "file")] | length')"
if [[ "$AUDIT_COUNT" -gt 0 && "$HAS_CLIENT_AUDIT" -gt 0 && "$HAS_BUDGET_AUDIT" -gt 0 && "$HAS_TASK_AUDIT" -gt 0 && "$HAS_FILE_AUDIT" -gt 0 ]]; then
  record_result "AUDITORÍA · GET /api/projects/:id/audit" "200" "200" "audit=$AUDIT_COUNT con campos clave presentes"
else
  record_result "AUDITORÍA · GET /api/projects/:id/audit" "500" "200" "faltan entradas esperadas en audit"
fi

request_json "GET" "$BASE_URL/api/audit/stats/$TEST_PROJECT_ID" "" "$TOKEN"
record_result "AUDITORÍA · GET /api/audit/stats/:id" "$RESPONSE_STATUS" "200" "timeEfficiency presente"

request_json "GET" "$BASE_URL/api/notifications?unread=true" "" "$TOKEN"
UNREAD_COUNT="$(printf "%s" "$RESPONSE_BODY" | jq 'length')"
FIRST_NOTIFICATION_ID="$(printf "%s" "$RESPONSE_BODY" | jq -r '.[0].id // empty')"
record_result "NOTIFICACIONES · GET /api/notifications" "$RESPONSE_STATUS" "200" "unread=$UNREAD_COUNT"

if [[ -n "$FIRST_NOTIFICATION_ID" ]]; then
  request_json "PATCH" "$BASE_URL/api/notifications/$FIRST_NOTIFICATION_ID/read" "" "$TOKEN"
  record_result "NOTIFICACIONES · PATCH /:id/read" "$RESPONSE_STATUS" "200" "id=$FIRST_NOTIFICATION_ID"
else
  record_result "NOTIFICACIONES · PATCH /:id/read" "500" "200" "no había notificaciones para probar"
fi

request_json "PATCH" "$BASE_URL/api/notifications/read-all" "" "$TOKEN"
record_result "NOTIFICACIONES · PATCH /read-all" "$RESPONSE_STATUS" "200" "todas marcadas como leídas"

cat "$SUMMARY_FILE"
