# Proxy de entrada: repassa tudo ao site (web) e, depois do horário configurado, mostra só a página de manutenção.
FROM nginxinc/nginx-unprivileged:stable-alpine
# Fuso de São Paulo para a janela diária (sem horário de verão desde 2019)
USER root
RUN apk add --no-cache tzdata
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY manutencao /usr/share/manutencao
COPY vigia.sh /vigia.sh
EXPOSE 8081
CMD ["/bin/sh", "/vigia.sh"]
