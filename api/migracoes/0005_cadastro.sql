-- Migração 0005 (Lote 6, item 1): senha provisória e sessão limitada para trocar a senha.

ALTER TABLE credencial ADD COLUMN senha_provisoria boolean NOT NULL DEFAULT false;

ALTER TABLE sessao DROP CONSTRAINT sessao_nivel_check;
ALTER TABLE sessao ADD CONSTRAINT sessao_nivel_check
  CHECK (nivel IN ('completo', 'configurar_totp', 'trocar_senha'));
