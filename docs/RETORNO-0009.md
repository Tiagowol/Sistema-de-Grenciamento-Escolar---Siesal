# Retorno da migração 0009 (Lote 16: avisos curtos e "visto" do sino)

A 0009 só acrescenta 2 tabelas (`aviso_escolar`, `aviso_visto`), 2 funções de gatilho (`aviso_escolar_conferir`, `aviso_escolar_so_desativar`) e as políticas de RLS. Nenhuma tabela existente é alterada. A migração só é aplicada pelo job `migrate`, com backup antes e com o seu "sim".

## Antes de aplicar (backup)
1. No terminal WSL: `bash scripts/backup.sh`.
2. Conferir o arquivo `backups/siesal-AAAAMMDD-HHMMSS.dump` e o `.sha256` gerado (o arquivo não pode estar vazio).
3. Só então aplicar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`.

## Opção 1 — restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da 0009 com `pg_restore --clean --if-exists` no banco do projeto (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup (inclusive avisos e "vistos" de teste).

## Opção 2 — remover só o que a 0009 criou (sem tocar no resto)
Só use se as 2 tabelas não tiverem dado que importe. Rode no banco como administrador:

```sql
BEGIN;
DROP TABLE aviso_visto, aviso_escolar CASCADE;
DROP FUNCTION aviso_escolar_conferir(), aviso_escolar_so_desativar();
DELETE FROM _migracoes WHERE nome = '0009_avisos.sql';
COMMIT;
```

Depois, volte o código ao commit anterior ao L16 para a API não procurar as tabelas.
A auditoria (`auditoria_evento`) é append-only e guarda os eventos `aviso.*` e `caixa.*`; eles permanecem (nada se apaga).
