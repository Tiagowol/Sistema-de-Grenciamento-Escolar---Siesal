# MENSAGEM PARA O CODE — 12/11/2026, 17:40

Leia o `CLAUDE.md` e esta mensagem inteira antes de agir. Responda em PT-BR.

## ESTADO
- O G0 já foi feito pelo Claude do chat: plano, Adendos 1 a 4, termos, registro A-071, diário e `CLAUDE.md` estão em `docs/` e no commit de documentos de 12/11/2026.
- Leia antes de começar: `docs/REGISTRO-DE-APROVACOES.md` (A-069 a A-071), `docs/PLANO-FECHAMENTO-PARTE-1-2026-11-12.md` e `docs/ADENDO-4-APROVACOES-E-RITMO-2026-11-12-1700.md`.
- Entrega da Parte 1: 20/12/2026. Código novo só até 16/12.

## PASSO 1 — Conferências (sem código)
1. `git status` e `git log -3`: confirmar que o commit de documentos está no ramo e no GitHub. Se o push não saiu, fazer o push (autorização permanente para `docs/` e `CLAUDE.md`).
2. Conferir e anotar no diário: a API foi recriada depois da troca da `CPF_CHAVE`; quantos CPFs há no banco.
- Terminou quando: as 2 respostas estão no diário.

## PASSO 2 — L21a (Endurecimento) — aprovado
1. HSTS em `web/seguranca.conf`, pronto e **desligado**; liga só com HTTPS. Dizer como ligar.
2. Teste automático de injeção de SQL em todas as rotas que recebem texto.
3. Causa do F-056: a resposta sai depois do `COMMIT`, em todos os módulos; retirar o contorno dos testes.
4. Conferir sem código novo e anotar: valor de `AUTH_MODO_LOCAL` no site externo; se existe limite de tentativas de login por endereço de rede (hoje o bloqueio é por conta: 5 falhas, 15 minutos).
5. Lint, tipos e todos os testes passando. Atualizar `docs/REGISTRO-DE-FALHAS.md` (F-056).
- Terminou quando: os testes passam sem o contorno e a entrega lista o que foi conferido.

## PASSO 3 — L21c + L21b (juntos, depois do L21a entregue) — aprovados
1. Restaurar um backup em banco limpo com as 23 migrações e comparar as contagens.
2. Arquivos de convite do Master fora da pasta `backups/` (propor a pasta nova antes de mover).
3. Calendário: grade e lista; o aluno escolhe e a escolha fica salva por usuário.
- Terminou quando: restauração documentada; convites na pasta nova; a escolha do calendário se mantém depois de novo login.

## REGRAS DESTA SESSÃO
- Um lote por vez. Não começar o PASSO 3 antes de entregar o PASSO 2.
- Sem merge em `siesal-4`. Sem deploy fora do computador. "Aplicar no site" e commit de código pedem autorização própria.
- Migração só pelo job `migrate`, com backup antes e retorno escrito. Nenhum destes passos deve precisar de migração; se precisar, pare e pergunte.
- Só dados fictícios. Nenhum segredo em arquivo, log ou chat.
- Falha: corrigir e registrar em `docs/REGISTRO-DE-FALHAS.md`. Se um passo falhar 2 vezes, pare.
- Ao fim de cada passo: Feito, Falta, Sugestões, e diário em `docs/diario/` com commit e push de `docs/`.
- No fim da sessão: escrever o "estado real" (ramo, commit, migrações, o que foi aplicado no site) para o autor levar ao Projeto do claude.ai.
