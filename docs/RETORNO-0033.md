# RETORNO da migração 0033 (L22f) — suporte do espaço individual

A 0033 **adiciona** uma coluna (`pedido_suporte.atendido_pela_plataforma`), uma tabela (`atendente_suporte`) e 9 funções, e **troca uma regra** (CHECK) de `pedido_suporte` por outra que também aceita "atendido pela plataforma". Não apaga nem muda dado existente.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guarde o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Restaurar o backup** feito antes da 0033 (perde o que foi gravado depois dele). É o caminho mais simples e seguro.
- **B. Desfazer só a 0033** (o site precisa estar com o código anterior ao L22f; senão a tela de Suporte dos espaços e a indicação de atendente falham):
  ```sql
  DROP FUNCTION IF EXISTS suporte_ind_atender_admin(uuid, uuid, uuid, uuid);
  DROP FUNCTION IF EXISTS suporte_ind_contar_admin(uuid, uuid);
  DROP FUNCTION IF EXISTS suporte_ind_listar_admin(uuid, uuid);
  DROP FUNCTION IF EXISTS suporte_ind_atender(uuid, uuid);
  DROP FUNCTION IF EXISTS suporte_ind_contar();
  DROP FUNCTION IF EXISTS suporte_ind_listar();
  DROP FUNCTION IF EXISTS suporte_atendente_retirar(uuid, uuid, text);
  DROP FUNCTION IF EXISTS suporte_atendente_indicar(uuid, uuid, text);
  DROP FUNCTION IF EXISTS suporte_atendentes_candidatos();
  DROP FUNCTION IF EXISTS suporte_atendente_ativo(uuid, uuid);
  DROP TABLE IF EXISTS atendente_suporte;
  ALTER TABLE pedido_suporte DROP CONSTRAINT pedido_suporte_atendimento;
  -- Pedido já atendido pela plataforma não cabe na regra antiga: volta a "aberto" (o texto continua guardado)
  UPDATE pedido_suporte SET estado = 'aberto', atendido_em = NULL WHERE atendido_pela_plataforma;
  ALTER TABLE pedido_suporte DROP COLUMN atendido_pela_plataforma;
  ALTER TABLE pedido_suporte ADD CONSTRAINT pedido_suporte_check1 CHECK (
    (estado = 'aberto' AND atendido_por IS NULL AND atendido_em IS NULL)
    OR (estado = 'atendido' AND atendido_por IS NOT NULL AND atendido_em IS NOT NULL));
  DELETE FROM _migracoes WHERE nome = '0033_suporte_individual.sql';
  ```
  Atenção: apagar `atendente_suporte` **perde** a lista de quem foi indicado (e o histórico de retiradas). Os eventos `suporte.atendido` já gravados na cadeia de auditoria dos espaços **ficam** (a auditoria é append-only).

## Código
`git revert` dos commits do L22f, depois `docker compose up -d --build` e `docker compose restart proxy`.
