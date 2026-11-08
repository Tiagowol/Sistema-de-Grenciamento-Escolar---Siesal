#!/usr/bin/env bash
# Backup do banco antes de qualquer migração (regra do projeto). Grava em backups/ (fora do git).
# Uso: bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
arquivo="backups/siesal-$(date +%Y%m%d-%H%M%S).dump"
# -Fc: formato próprio do pg_dump, restaurável com pg_restore
docker compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$arquivo"
# O arquivo precisa ter conteúdo; senão o backup falhou
[ -s "$arquivo" ] || { echo "ERRO: backup vazio, apagando $arquivo" >&2; rm -f "$arquivo"; exit 1; }
sha256sum "$arquivo" | tee "$arquivo.sha256"
echo "Backup feito: $arquivo"
