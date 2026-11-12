# Proposta — Lote 20c-2 (cadastro com CPF e responsável)

Passo 2 do ciclo. **Nada foi codado.** Só dados fictícios. Decisões do autor: D2b = CPF do maior de 18 opcional; D7 = sem foto de documento; D8 = caixa de teste no Docker agora, envio real de e-mail na Parte 2. D10 e D11 estão fora do escopo.

## 1. Estado anterior (lido em 12/11/2026)
- `usuario` não tem data de nascimento, CPF nem matrícula (`0001_base.sql`).
- O convite individual (`api/src/auth/convite-individual.ts`, função SQL `espaco_individual_criar`) pede só código, nome, e-mail e senha.
- A cifra existente (`api/src/auth/cifra.ts`) é AES-256-GCM com chave derivada de `AUTH_SECRET`, usada para o TOTP.
- O `compose.yaml` não tem serviço de e-mail.
- Migrações até a 0021. Matriz em v16.

## 2. O que será feito (3 itens, como no PLANO-L20C)
1. **Dados do aluno.** Tabela `aluno_dados` (RLS forçada, `withTenant`): data de nascimento, CPF cifrado, índice do CPF por HMAC (para achar duplicidade sem decifrar), 2 últimos dígitos para a máscara, matrícula opcional, escola(s) em texto opcional. CPF só aparece mascarado. Nunca em log, resposta de API ou auditoria.
2. **Menor de 18 anos.** A conta nasce "aguardando o responsável" e não guarda dado escolar. O formulário pede nome, CPF, data de nascimento e e-mail do responsável. Confere os dígitos dos 2 CPFs, que sejam diferentes e que o responsável tenha 18 anos ou mais. Link de uso único válido por 7 dias. Sem confirmação, o pedido expira e os dados do pedido são apagados.
3. **Autorização do responsável.** Termo literal com 3 caixas. Prova guardada: versão do termo, data e hora e identificador do pedido (sem CPF). O e-mail com o link vai para a caixa de teste (Mailpit) dentro do Docker.

## 3. Arquivos
**Novos**
- `api/migracoes/0022_cadastro_cpf.sql`: `aluno_dados`, `pedido_responsavel`, situação "aguardando_responsavel" (conferir a restrição atual de `usuario.situacao`).
- `api/src/auth/cpf.ts`: validar, mascarar, cifrar e gerar o HMAC do CPF.
- `api/src/auth/cadastro-responsavel.ts`: pedido, link, confirmação, expiração.
- `api/src/auth/cpf.test.ts` e `cadastro-responsavel.integracao.test.ts`.
- `docs/RETORNO-0022.md`.

**Alterados**
- `api/src/auth/cifra.ts`: derivação de uma chave separada para o CPF (info diferente da do TOTP).
- `api/src/auth/convite-individual.ts` e a função SQL de criação: recebem data de nascimento e, se for menor, ficam aguardando.
- Rota e página de cadastro (a localizar em `api/src/app.ts` e `web/src/paginas/`).
- `shared/src/permissoes.json` (v17) e os testes gerados por ela.
- `compose.yaml`, `.env.example`: serviço Mailpit só em 127.0.0.1 e segredo da chave do CPF fora do git.
- `docs/REGISTRO-DE-APROVACOES.md` e `docs/PLANO-L20C.md` (corrigir 0021 para 0022 e v16 para v17).

## 4. Migração e backup
- Migração **0022**, só pelo job `migrate`, com backup antes (`bash scripts/backup.sh`, depois `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`). **Eu só aviso; quem roda é você.**
- Retorno descrito em `docs/RETORNO-0022.md` antes de executar.
- A chave do CPF precisa de cópia segura. Perder a chave torna os CPFs ilegíveis.

## 5. Tempo concreto (tela nova)
O prazo do link do responsável aparece com palavra, data (dia/mês) e barra que diminui, por exemplo "vale até 19/11, faltam 7 dias". Texto literal, sem pressão.

## 6. Validação
Lint, typecheck e testes no Docker. Testes novos: nenhum valor de CPF em resposta de API, log ou auditoria; menor de 18 não conclui sozinho; pedido expirado some; CPFs iguais são recusados; link usado duas vezes é recusado. Telas passam no axe e no teclado e funcionam em 360, 768 e 1280 px. "Verificado" só depois da sua checagem humana.

## 7. O que este lote não faz
Prova de que o CPF é do responsável (só confere os dígitos), foto de documento, envio real de e-mail, conta gov.br, vínculo com escola, SUAP.

## 8. Decisão tomada pelo autor em 12/11/2026: Mailpit + nodemailer
(Opções que existiam, mantidas para registro.)
**Mailpit + nodemailer (recomendada)** ou **só uma tabela de caixa de teste, sem container novo**. A primeira traz 1 imagem e 1 dependência (versões exatas), mas na Parte 2 basta trocar o servidor de e-mail. A segunda é mais enxuta, mas será refeita na Parte 2.

## 9. Premissa a confirmar
Confirmar o link do responsável **ativa a conta do aluno**. Não cria conta de Responsável nesta parte. Se for diferente, aviso antes de codar.
