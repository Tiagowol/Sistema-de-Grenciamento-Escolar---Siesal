#!/usr/bin/env bash
# Verificação do ambiente ANTES de iniciar qualquer projeto: só LEITURA, não muda nada.
# Mostra o que já roda no Docker, as portas em uso e as redes. Nunca para, apaga ou altera nada.
# Uso: bash scripts/verificar-ambiente.sh [porta ...]   (sem argumentos, usa WEB_PORTA e API_PORTA do .env)
set -u

linha() { printf '\n== %s ==\n' "$1"; }

linha "1. Docker"
if ! command -v docker >/dev/null 2>&1; then echo "Docker não encontrado neste terminal."; exit 1; fi
docker version --format 'Docker {{.Server.Version}}' 2>/dev/null || echo "Docker não responde (ele está ligado?)"
docker compose version --short 2>/dev/null | sed 's/^/Compose /'

linha "2. Contêineres (todos, rodando ou parados)"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null

linha "3. Projetos do Compose"
docker compose ls -a 2>/dev/null

linha "4. Redes (nome, tipo e faixa de IP)"
for r in $(docker network ls --format '{{.Name}}' 2>/dev/null); do
  docker network inspect "$r" --format '{{.Name}} | {{.Driver}} | {{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null
done

linha "5. Volumes"
docker volume ls --format '{{.Name}}' 2>/dev/null

linha "6. Portas em uso neste computador"
if command -v ss >/dev/null 2>&1; then ss -ltn 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -un | tr '\n' ' '; echo; fi

linha "7. Portas que este projeto quer usar"
if [ "$#" -gt 0 ]; then PORTAS="$*"; else
  PORTAS=""
  if [ -f .env ]; then
    for k in WEB_PORTA API_PORTA; do v=$(grep -E "^$k=" .env | head -1 | cut -d= -f2); [ -n "$v" ] && PORTAS="$PORTAS $v"; done
  fi
  [ -z "$PORTAS" ] && PORTAS="8080 3000"
fi
for p in $PORTAS; do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$p$"; then
    dono=$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ":$p->" | awk '{print $1}' | head -1)
    echo "Porta $p: EM USO ${dono:+(contêiner $dono)}"
  else
    echo "Porta $p: livre"
  fi
done

linha "8. Isolamento (TI-REX e outros sistemas)"
docker ps -a --format '{{.Names}}' 2>/dev/null | grep -iE 'n8n|evolution|chatwoot|glpi|apache|mariadb|tirex|ti-rex' | sed 's/^/Existe (NÃO mexer): /' || true
echo "Regra: este projeto só usa contêineres, redes e volumes com o prefixo 'siesal'."

linha "Resumo"
echo "Leia as seções 2, 4 e 7. Se alguma porta estiver EM USO por outro sistema, mude WEB_PORTA/API_PORTA no .env antes de subir."
