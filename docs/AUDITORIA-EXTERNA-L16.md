# Auditoria externa do L16 (acesso temporário, 08/11/2026)

Objetivo exclusivo: permitir a auditoria externa do L16 e achar problemas antes da aprovação definitiva. Sem novo lote de desenvolvimento.
Procedimento reutilizável: `docs/ACESSO-PUBLICO-TEMPORARIO.md`.

## Estado anterior (antes de ligar)
- Ramo `lote-16-avisos`, sem commit do L16. Migração 0009 aplicada (backup `siesal-20261108-155023.dump`).
- Novo backup antes das contas: `backups/siesal-20261108-160210.dump`. `.env` anterior: `backups/env.antes-auditoria-L16` (fora do git).
- Containers: `siesal-web-1` (`127.0.0.1:18080`), `siesal-api-1` (`127.0.0.1:3000`), `siesal-db-1` (sem porta). Nenhum container do TI-REX.
- `.env`: `AUTH_MODO_LOCAL=sim`, `TRUST_PROXY=sim`, `WEB_BIND=127.0.0.1`. `/api/config` devolvia `modo_local:true`.

## O que mudou
- `.env`: `AUTH_MODO_LOCAL=nao` (cookie `Secure` e `__Host-`). API recriada. Nenhum outro container reiniciado. Código, migrations e esquema: sem alteração.
- Dados fictícios novos no banco (inseridos por script, sem eventos de auditoria de criação):
  - 5 contas de auditoria em "Instituição Demonstração": 2 alunos, 1 professor, 1 responsável, 1 pedagógico (`auditoria.l16.*@exemplo.invalid`), com turma, disciplina, notas, 2 pedidos de revisão abertos, 1 aviso e tarefas.
  - 10 contas internas de verificação (`ver.l16*`, na Demonstração e na Escola Fictícia B), **desativadas** ao fim.
- Túnel: container `siesal-tunel` (imagem por digest, somente leitura, sem capacidades, rede `siesal_web`, sem porta publicada) e tarefa agendada de encerramento em 2 horas.

## Resultado das verificações pela URL HTTPS (104 verificações)
- 100 aprovadas na primeira execução. 4 marcadas como falha, assim explicadas:
  1. `Permissions-Policy` ausente na página inicial: falha real (F-038), **corrigida no L16a em 08/11/2026** (`web/seguranca.conf`).
  2. HTTP simples responde 200: **limite do `trycloudflare.com`**, sem correção possível aqui. Não há sessão por HTTP, por causa do cookie `Secure`.
  3. "Escola B recebe aviso da Demonstração": **falso alarme do meu teste**. A Escola B tem o próprio aviso, com a mesma turma ("Turma Auditoria 7º A") e o mesmo texto; conferido no banco (1 aviso por turma, cada um na sua instituição).
  4. "Limite de tentativas ignora cabeçalhos forjados": **teste inválido na primeira execução** (a Cloudflare respondeu 403 ao `CF-Connecting-IP` forjado). Repetido só com `X-Forwarded-For` e `X-Real-IP` forjados, com IP diferente a cada chamada: 10 respostas 401 e depois 429. O limite usa o endereço visto pelo nginx, não o do cliente.
- Cookie: `__Host-siesal_sessao`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, sem `Domain`. Cookie sem o prefixo e token inventado: 401. Logout invalida o token.
- Sem sessão: 401 em todas as rotas protegidas testadas. Com sessão de perfil sem permissão: 403 (aluno, responsável, professor e pedagógico).
- Isolamento entre usuários (mesma turma): cada aluno vê só a própria nota e as próprias tarefas; o responsável só a do aluno vinculado; o professor só a da sua turma.
- Isolamento entre instituições: contas da Escola B não entram pela Demonstração, não veem notas nem avisos da Demonstração e recebem 404 ao tentar publicar, revisar ou pedir revisão na Demonstração.
- L16: a caixa do professor mostra os pedidos; revisar fecha juntos os 2 pedidos da nota; aluno e responsável recebem só estado e nota atual; o motivo da revisão e as versões antigas não aparecem para aluno, responsável nem Pedagógico em nenhuma rota; o professor continua vendo o histórico.
- Exposição: só o serviço web pelo túnel. PostgreSQL (5432) e Redis (6379) sem porta no computador. Porta 3000 só em `127.0.0.1` e inacessível pelo túnel. A porta 8080 do computador é do Windows (`svchost`) e não faz parte do SIESAL.
- Admin e Master: não disponibilizados. A tela do Admin (TOTP) continua sem conferência.

## Incidente registrado
- Um comando meu imprimiu na tela uma linha do arquivo de acesso, com a senha provisória do aluno 1. A senha foi girada logo em seguida, sem imprimir, e a antiga deixou de valer. Nenhuma outra credencial foi exibida.

## Achados para o autor
- **F-038 (corrigida no L16a, 08/11/2026):** `Permissions-Policy` não chegava na página inicial. Causa: no nginx, `add_header` dentro de `location /` substitui os do nível `server`. Correção: os cabeçalhos foram para `web/seguranca.conf`, incluído em todos os blocos do nginx.
- Limite de login compartilhado atrás do túnel (10 por minuto para todos); ver `ACESSO-PUBLICO-TEMPORARIO.md`.
