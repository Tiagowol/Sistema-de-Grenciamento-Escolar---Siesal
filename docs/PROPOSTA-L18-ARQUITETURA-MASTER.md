# L18 — Como a API opera como Master sem tocar em dado escolar (10/11/2026)

Estado: **Implementado** (não "Verificado": falta a checagem humana). Aprovação do lote: A-031, item 4.

## 1. O problema
O papel `siesal_ops` (migração 0003) é `NOLOGIN`. A API só tem uma conexão, com o papel `siesal_app`, que não lê `operator_account`. Faltava um caminho para a API agir como Master.

## 2. Escolha: `SET LOCAL ROLE siesal_ops`, só dentro de uma transação
- O job `migrate` executa `GRANT siesal_ops TO siesal_app WITH INHERIT FALSE, SET TRUE`.
- **Sem herança**: fora do `SET ROLE`, `siesal_app` continua sem nenhuma permissão nas tabelas dos Masters (provado por teste).
- A API tem uma única porta para isso: `comoOperacao()` em `api/src/operacao/servico.ts`. Ela abre uma transação, faz `SET LOCAL ROLE siesal_ops` e roda a função. No `COMMIT` ou `ROLLBACK` o papel volta sozinho para `siesal_app`.
- Dentro dessa transação o papel é `siesal_ops`, que só tem `GRANT` em: `instituicao` (ler, criar, alterar), `operator_account`, `operator_sessao` e `operator_auditoria`. Em toda tabela escolar o banco responde "permission denied".
- Nenhuma rota `/operacao/*` usa `withTenant`. Nenhuma rota escolar usa `comoOperacao`.

## 3. Por que é seguro
| Risco | Proteção | Prova |
|---|---|---|
| Master ler dado escolar | `siesal_ops` não tem `GRANT` em tabela escolar | teste percorre todas as tabelas do esquema e exige "permission denied" |
| Código escolar ler tabela de Master | concessão sem herança; RLS das tabelas `operator_*` só para `siesal_ops` | teste: `siesal_app` sem `SET ROLE` recebe "permission denied" |
| O papel "vazar" para o pedido seguinte | `SET LOCAL` vale só na transação | teste confere `current_user` depois |
| `siesal_ops` virar dono do banco | não é membro de `siesal_owner`; sem `SUPERUSER` nem `BYPASSRLS` | teste: `SET ROLE siesal_owner` falha |
| Cookie da escola valer em `/operacao` (e o contrário) | cookies, tabelas de sessão e formato de token diferentes | teste nos dois sentidos |
| Adivinhar senha, convite ou código | limite por IP (10 por minuto), bloqueio de 15 minutos após 5 falhas, resposta igual para usuário desconhecido | testes |

## 4. Alternativa não escolhida
Segunda conexão com um papel de login próprio (`siesal_ops_login`). Protege melhor contra injeção de SQL nas rotas escolares, mas pede um segredo novo no `.env`, uma segunda conexão e mudança no `compose.yaml`. As rotas usam consultas parametrizadas do Prisma; o ganho hoje é pequeno. Fica como sugestão de endurecimento (Parte 2, antes do piloto).

## 5. Fluxo do Master
1. **Convite** (comando manual, só no computador do servidor): gera um código de uso único, válido por 30 minutos. O banco guarda só o hash.
2. **Primeiro acesso** em `/operacao`: usuário + convite + senha nova (12 caracteres ou mais). A sessão nasce limitada (15 minutos): só serve para ativar o TOTP.
3. **TOTP obrigatório**: sem ele não existe sessão completa. A conta só vira `ativo` com senha e TOTP (regra também no banco, por `CHECK`).
4. **Entrar**: usuário + senha + código de 6 números, sempre. Sessão de 1 hora, cookie `__Host-siesal_operacao` (HttpOnly, Secure, SameSite=Strict).
5. **Perdeu a senha ou o aplicativo**: emitir novo convite. Ele redefine a senha e exige configurar o TOTP de novo. Não há códigos de recuperação para o Master (decisão: menos segredos guardados).

## 6. Divisa com o L20 (mantida como no roteiro, seção 4)
- L18: entrar, listar instituições (nome, situação, data), criar, suspender e reativar.
- Suspender tem efeito real: ninguém da instituição entra e as sessões abertas deixam de valer.
- A trilha do Master (`operator_auditoria`, append-only com hash) já nasce separada da escolar, porque o login precisa de auditoria. As **contagens agregadas**, os 4 estados, os módulos e a página de status ficam no L20.
- **Não entra**: criar o primeiro Admin da instituição pelo painel. Isso gravaria em tabela escolar. Continua pelo job `instituicao`. Decisão para o L20.

## 7. Matriz de permissões
Sem versão nova (segue v9). A permissão `instituicoes.criar_suspender` = `master: plataforma` existe desde a v1 e é a única usada.
