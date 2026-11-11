-- Migração 0018 (L20a): tema com 4 valores e minutos dos 3 blocos de tempo por usuário.
-- Acrescenta 'alto_contraste_escuro' ao tema e 3 colunas de minutos em preferencia_usuario (padrão 10, 25 e 45).
-- Nada se apaga: as linhas existentes mantêm o tema que tinham e ganham os minutos padrão.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0018.md.

ALTER TABLE preferencia_usuario DROP CONSTRAINT preferencia_usuario_tema_check;
ALTER TABLE preferencia_usuario ADD CONSTRAINT preferencia_usuario_tema_check
  CHECK (tema IN ('claro', 'escuro', 'alto_contraste', 'alto_contraste_escuro'));

ALTER TABLE preferencia_usuario
  ADD COLUMN minutos_curto integer NOT NULL DEFAULT 10,
  ADD COLUMN minutos_medio integer NOT NULL DEFAULT 25,
  ADD COLUMN minutos_longo integer NOT NULL DEFAULT 45;
-- De 5 a 120, de 5 em 5, sempre curto < médio < longo (o aluno usa botões; não digita minutos)
ALTER TABLE preferencia_usuario ADD CONSTRAINT preferencia_usuario_blocos_check CHECK (
  minutos_curto BETWEEN 5 AND 120 AND minutos_medio BETWEEN 5 AND 120 AND minutos_longo BETWEEN 5 AND 120
  AND minutos_curto % 5 = 0 AND minutos_medio % 5 = 0 AND minutos_longo % 5 = 0
  AND minutos_curto < minutos_medio AND minutos_medio < minutos_longo
);
-- A política de acesso (RLS) e as permissões da 0012 continuam valendo sem mudança.
