#!/usr/bin/env bash
# Manutenção manual do proxy (L16c). Uso: bash scripts/manutencao.sh ligar|liberar|automatico|estado
# Só altera MANUTENCAO_MODO no .env e refaz o container "proxy". Não mexe em banco nem em dados.
set -euo pipefail
cd "$(dirname "$0")/.."
definir() {
  if grep -q '^MANUTENCAO_MODO=' .env; then sed -i "s/^MANUTENCAO_MODO=.*/MANUTENCAO_MODO=$1/" .env; else printf '\nMANUTENCAO_MODO=%s\n' "$1" >> .env; fi
  docker compose up -d proxy
  echo "Modo da manutenção: $1"
}
case "${1:-}" in
  ligar) definir ligada ;;
  liberar) definir liberada ;;
  automatico) definir auto ;;
  estado)
    echo "Modo no .env: $(grep '^MANUTENCAO_MODO=' .env | cut -d= -f2- || echo auto)"
    echo "Janela no .env: $(grep '^MANUTENCAO_JANELA=' .env | cut -d= -f2- || echo 06:00-23:59)"
    printf 'Resposta agora em http://127.0.0.1:18081/: '; curl -s -o /dev/null -w '%{http_code} (200 = aberto, 503 = manutenção)\n' http://127.0.0.1:18081/ ;;
  *) echo "Uso: bash scripts/manutencao.sh ligar|liberar|automatico|estado"; exit 1 ;;
esac
