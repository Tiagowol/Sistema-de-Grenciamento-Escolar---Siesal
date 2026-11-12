# Retorno da migração 0022 (20c-2)

A 0022 acrescenta: a situação `aguardando_responsavel` em `usuario`, as tabelas `aluno_dados` e `pedido_responsavel` e 4 funções (`cadastro_aluno_criar`, `pedido_responsavel_limpar`, `pedido_responsavel_consultar`, `pedido_responsavel_confirmar`). **Não altera nem apaga** dado existente. A restrição de `usuario.situacao` só ganha um valor.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. Preencher `CPF_CHAVE` no `.env` (mínimo 32 caracteres, só para isso) e **guardar uma cópia segura fora do git**. Perder a chave torna os CPFs ilegíveis. Sem a chave, o cadastro com CPF fica desligado (a API responde 503 só nesse caso).
4. A caixa de teste de e-mail (Mailpit, serviço `caixa-teste`) sobe junto com `docker compose up -d --build`. Ver as mensagens: http://127.0.0.1:18025 (só neste computador). Ela não envia nada para fora.
5. A API só reconstrói com o procedimento da F-052 (certificado do Norton).

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (só se nenhum aluno foi cadastrado com a 0022; senão, `aluno_dados` e `pedido_responsavel` somem com os dados):
```sql
DROP FUNCTION pedido_responsavel_confirmar(text, text);
DROP FUNCTION pedido_responsavel_consultar(text);
DROP FUNCTION pedido_responsavel_limpar();
DROP FUNCTION cadastro_aluno_criar(text, text, text, text, date, jsonb, jsonb, text);
DROP TABLE pedido_responsavel;
DROP TABLE aluno_dados;
-- contas "aguardando_responsavel" ou inativas por vencimento precisam voltar a um valor antigo antes de trocar a restrição
UPDATE usuario SET situacao = 'inativo' WHERE situacao = 'aguardando_responsavel';
ALTER TABLE usuario DROP CONSTRAINT usuario_situacao_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_situacao_check CHECK (situacao IN ('ativo', 'inativo'));
DELETE FROM _migracoes WHERE nome LIKE '0022%';
```
Ao voltar o código, voltar também o ramo (sem a 0022 a API nova não cria conta).

## Observações
- O apagamento do pedido vencido é de verdade (pedido e `aluno_dados`), decisão do autor em 12/11/2026. A conta do menor não se apaga: fica `inativo` com `desativado_em`.
- O texto claro do CPF nunca é gravado. Se a chave for trocada, os CPFs já cifrados não abrem; troca de chave exige um passo de recifragem (não existe nesta parte).
