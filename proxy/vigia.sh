#!/bin/sh
# Decide, a cada 15 s, se o sistema está aberto ou em manutenção, e inicia o nginx.
# MANUTENCAO_MODO: "auto" (padrão: segue a janela diária), "ligada" (manutenção agora) ou "liberada" (aberto agora).
# MANUTENCAO_JANELA: "HH:MM-HH:MM", horário de America/Sao_Paulo em que o sistema fica ABERTO (padrão 06:00-23:59).
#   Fora da janela: manutenção. Vazio = sem janela (sempre aberto no modo auto).
FLAG=/tmp/manutencao
export TZ=America/Sao_Paulo

minutos() { # "HH:MM" -> minutos desde 00:00
  h=${1%%:*}; m=${1##*:}
  h=$(echo "$h" | sed 's/^0*\(.\)/\1/'); m=$(echo "$m" | sed 's/^0*\(.\)/\1/')
  echo $((h * 60 + m))
}

aberto_na_janela() {
  janela="${MANUTENCAO_JANELA:-06:00-23:59}"
  [ -z "$janela" ] && return 0
  ini=$(minutos "${janela%%-*}") || return 0
  fim=$(minutos "${janela##*-}") || return 0
  agora=$(minutos "$(date +%H:%M)")
  # A janela abre no minuto inicial e fecha ao fim do minuto final
  if [ "$ini" -le "$fim" ]; then
    [ "$agora" -ge "$ini" ] && [ "$agora" -le "$fim" ]
  else
    [ "$agora" -ge "$ini" ] || [ "$agora" -le "$fim" ]
  fi
}

avaliar() {
  case "${MANUTENCAO_MODO:-auto}" in
    ligada) : > "$FLAG" ;;
    liberada) rm -f "$FLAG" ;;
    *) if aberto_na_janela; then rm -f "$FLAG"; else : > "$FLAG"; fi ;;
  esac
}

avaliar
# Se o computador dormir, a primeira checagem ao acordar já vê o horário atual
( while true; do sleep 15; avaliar; done ) &
exec nginx -g 'daemon off;'
