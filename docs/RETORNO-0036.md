# RETORNO da migração 0036 (L22k) — Admin indicado por função

A 0036 **cria** a tabela `admin_indicacao_funcao` e 4 funções (`admin_funcao_ativa`, `admin_funcoes_candidatos`, `admin_funcao_indicar`, `admin_funcao_retirar`), **troca o corpo** de 5 funções (`suporte_atendente_ativo` e as 4 `pedido_convite_*_admin`) e **tira do Master** o uso das 3 funções antigas de indicação (`suporte_atendente_*`). Copia cada indicação vigente da `atendente_suporte` para as duas funções. A `atendente_suporte` não muda.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guarde o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Restaurar o backup** feito antes da 0036 (perde indicações feitas depois dela).
- **B. Desfazer só a 0036** (o site precisa voltar ao código anterior ao L22k). Volta ao comportamento do L22i: quem está na `atendente_suporte` faz as duas funções.
  ```sql
  CREATE OR REPLACE FUNCTION suporte_atendente_ativo(p_inst uuid, p_usuario uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_ok boolean;
  BEGIN
    IF p_inst IS NULL OR p_usuario IS NULL THEN RETURN false; END IF;
    PERFORM set_config('app.instituicao_id', p_inst::text, true);
    SELECT EXISTS (
      SELECT 1 FROM atendente_suporte a
        JOIN usuario u ON u.instituicao_id = a.instituicao_id AND u.id = a.usuario_id
        JOIN instituicao i ON i.id = a.instituicao_id
       WHERE a.instituicao_id = p_inst AND a.usuario_id = p_usuario AND a.retirado_em IS NULL
         AND u.perfil = 'admin' AND u.situacao = 'ativo' AND u.desativado_em IS NULL AND u.encerrada_em IS NULL
         AND i.tipo = 'escola' AND i.situacao = 'ativa'
    ) INTO v_ok;
    PERFORM set_config('app.instituicao_id', v_old, true);
    RETURN v_ok;
  END $$;
  ```
  Depois, recrie as 4 `pedido_convite_*_admin` copiando os blocos da `api/migracoes/0035_pedido_convite_decisao.sql` com `CREATE OR REPLACE` (eles chamam `suporte_atendente_ativo`). Então:
  ```sql
  GRANT EXECUTE ON FUNCTION suporte_atendentes_candidatos() TO siesal_ops;
  GRANT EXECUTE ON FUNCTION suporte_atendente_indicar(uuid, uuid, text) TO siesal_ops;
  GRANT EXECUTE ON FUNCTION suporte_atendente_retirar(uuid, uuid, text) TO siesal_ops;
  DROP FUNCTION IF EXISTS admin_funcao_retirar(uuid, uuid, text, text);
  DROP FUNCTION IF EXISTS admin_funcao_indicar(uuid, uuid, text, text);
  DROP FUNCTION IF EXISTS admin_funcoes_candidatos();
  DROP FUNCTION IF EXISTS admin_funcao_ativa(uuid, uuid, text);
  DELETE FROM _migracoes WHERE nome = '0036_admin_indicacao_funcao.sql';
  ```
  A tabela `admin_indicacao_funcao` pode ficar (nada se apaga); se ficar, a reaplicação da 0036 falha no `CREATE TABLE`: nesse caso, renomeie-a antes (`ALTER TABLE admin_indicacao_funcao RENAME TO admin_indicacao_funcao_antiga;`).
  Atenção: indicações feitas pela tela nova depois da 0036 **não** voltam para a `atendente_suporte`; refaça-as na tela antiga.

## Código
`git revert` dos commits do L22k, depois `docker compose up -d --build` e `docker compose restart proxy`.
