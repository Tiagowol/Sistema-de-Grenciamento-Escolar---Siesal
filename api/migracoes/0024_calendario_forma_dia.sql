-- Migração 0024 (L21b): forma de ver o dia no calendário, por usuário ('grade' de horas ou 'lista').
-- Acrescenta 1 coluna em preferencia_usuario. As linhas existentes ficam em 'grade' (o que já era o padrão da tela).
-- Nada se apaga. A política de acesso (RLS) e as permissões da 0012 continuam valendo sem mudança.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0024.md.

ALTER TABLE preferencia_usuario
  ADD COLUMN forma_dia text NOT NULL DEFAULT 'grade' CHECK (forma_dia IN ('grade', 'lista'));
