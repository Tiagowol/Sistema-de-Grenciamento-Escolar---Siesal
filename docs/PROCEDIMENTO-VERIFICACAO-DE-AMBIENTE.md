# Procedimento: verificação do ambiente (início de qualquer projeto)

Registrado em 08/11/2026 a pedido do proprietário. Vale para todo projeto novo e para todo retorno de sessão em que o Docker será usado.

## Quando
No começo de cada projeto ou de cada sessão de trabalho que vá subir contêineres, antes de `docker compose up`.

## O que verificar (só leitura)
1. Docker e Compose respondem?
2. Quais contêineres existem (rodando ou parados)?
3. Quais projetos do Compose existem?
4. Quais redes existem e que faixas de IP usam?
5. Quais portas já estão em uso?
6. Alguma porta que o projeto quer usar está ocupada?
7. Existem sistemas de outros projetos (TI-REX, n8n, Evolution, Chatwoot, GLPI, Apache, MariaDB)? Apenas listar. Nunca parar, apagar ou alterar.

## Comando (copiar e colar, na pasta do projeto)
```
bash scripts/verificar-ambiente.sh
```
Para testar portas específicas: `bash scripts/verificar-ambiente.sh 8080 3000`

## Critério de "terminou"
- Nenhuma porta do projeto aparece como EM USO por outro sistema (ou a porta foi trocada no `.env`).
- Os nomes `siesal*` são os únicos que o projeto cria. Nada do TI-REX foi tocado.

## Se houver conflito
1. Não pare nem apague o outro sistema.
2. Troque `WEB_PORTA` ou `API_PORTA` no `.env`.
3. Registre em `docs/REGISTRO-DE-FALHAS.md` se algo já tiver sido afetado.
