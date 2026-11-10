-- Migração 0015 (L17d): preferências de interface por usuário, para os 5 perfis escolares.
-- Rótulos do topo (ícones ou texto), VLibras mostrado ou não, e quando a pessoa aceitou o aviso do VLibras.
-- Sem dado sensível. Nada se apaga: mudar grava por cima e a auditoria guarda o histórico.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0015.md.

CREATE TABLE preferencia_interface (
  instituicao_id        uuid        NOT NULL REFERENCES instituicao (id),
  usuario_id            uuid        NOT NULL,
  rotulos               text        NOT NULL DEFAULT 'icones' CHECK (rotulos IN ('icones', 'texto')),
  vlibras               boolean     NOT NULL DEFAULT true,
  vlibras_aviso_aceito  timestamptz,
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, usuario_id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);

-- RLS: instituição do contexto (withTenant). O filtro por dono (usuario_id) é feito na API e provado nos testes.
ALTER TABLE preferencia_interface ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencia_interface FORCE ROW LEVEL SECURITY;
CREATE POLICY preferencia_interface_da_instituicao ON preferencia_interface
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON preferencia_interface TO siesal_app;
