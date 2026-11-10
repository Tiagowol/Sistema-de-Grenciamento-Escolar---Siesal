# Acesso público temporário ao SIESAL (decisão e procedimento)

Decisão do autor, 08/11/2026: o acesso público temporário fica **configurado e documentado**. Ele não fica ligado.
O autor liga e desliga com duas frases ao Code:

- **"ativar acesso público temporário"**: o Code executa o procedimento ATIVAR abaixo e entrega a URL HTTPS e o arquivo de acesso.
- **"desativar acesso público temporário"**: o Code executa o procedimento DESATIVAR abaixo e confirma.

## Como funciona
- Túnel rápido da Cloudflare (`trycloudflare.com`), em um container `siesal-tunel`, imagem oficial fixada por digest
  (`cloudflare/cloudflared@sha256:4955524aeaa379e154023d5a027c250f7b35041a2e7e950cf13f144bc9b9c5ba`, versão 2026.10.7).
- O túnel aponta só para o nginx do SIESAL (`http://web:8080`), pela rede interna `siesal_web`. Não publica porta no computador.
  PostgreSQL e API continuam sem porta pública (a API só em `127.0.0.1:3000`).
- A URL **muda a cada ativação** (túnel rápido não tem endereço fixo e não exige conta). Um endereço fixo exige um túnel
  nomeado, com conta e domínio Cloudflare do autor e um token que só o autor pode criar. Fica como opção futura.
- Encerramento automático em **2 horas**, por tarefa agendada do Windows (`SIESAL-encerrar-tunel-auditoria`),
  que não depende do Code nem desta sessão. Duração diferente só se o autor pedir na hora.

## Regras fixas (condições do autor)
1. Só dados fictícios do ambiente de demonstração. Sem Master e sem Admin. Contas exclusivas (aluno, professor, responsável, pedagógico).
2. Backup e `.env` anterior preservados antes de ativar; estado anterior registrado.
3. Cookie de sessão seguro (`Secure` e `__Host-`): `AUTH_MODO_LOCAL=nao` durante o acesso.
4. Nenhuma credencial no chat, em log, em commit ou no GitHub. O arquivo de acesso fica em `backups/` (fora do git) e é enviado só ao autor.
5. Não alterar migrations, esquema do banco nem código de funcionalidades. Nada do TI-REX é tocado.
6. Verificar login, logout, cookies, rotas protegidas e isolamento entre usuários e instituições antes de entregar a URL.

## ATIVAR (o Code executa, na ordem)
1. Conferir o estado: `docker compose ps` (sem `siesal-tunel`), `git status`, portas só em `127.0.0.1`.
2. Backup: `bash scripts/backup.sh` e cópia do `.env` para `backups/env.antes-acesso-publico` (fora do git).
3. Cookie seguro: `AUTH_MODO_LOCAL=nao` no `.env` e `docker compose up -d api`. Conferir `modo_local:false` em `/api/config`.
4. Contas de auditoria:
   - Se as 5 contas `auditoria.l16.*@exemplo.invalid` estão ativas, girar a senha provisória de cada uma com
     `scripts/auditoria/girar-senha.mjs` (senha só no arquivo `backups/auditoria/auditoria.json`).
   - Se foram desativadas, ou se o autor quer contas novas, criar com `scripts/auditoria/semear-auditoria.mjs`
     (uma execução para as contas de auditoria e uma para as de verificação interna; ver o cabeçalho do script).
   - Os scripts rodam no container do job `aluno-teste` (`docker compose --profile release run --rm --no-deps -v ... --entrypoint node aluno-teste /audit/<script>`).
5. Subir o túnel:
   `docker run -d --rm --name siesal-tunel --network siesal_web --read-only --cap-drop ALL --security-opt no-new-privileges --memory 256m --pids-limit 100 cloudflare/cloudflared@sha256:4955524aeaa379e154023d5a027c250f7b35041a2e7e950cf13f144bc9b9c5ba tunnel --no-autoupdate --url http://web:8080`
   e ler a URL em `docker logs siesal-tunel`.
6. Agendar o encerramento (PowerShell): tarefa única `SIESAL-encerrar-tunel-auditoria` em agora + 2 horas, executando
   `docker rm -f siesal-tunel`, com `-StartWhenAvailable`.
7. Verificar pela URL HTTPS: `python scripts/auditoria/verificar-externo.py <URL> <pasta com os JSON> <ID da Escola B>`
   (cabeçalhos, cookies, login e logout, 401 sem sessão, 403 por perfil, isolamento entre usuários e entre instituições,
   fluxo da caixa, cabeçalhos forjados). Usa contas internas de verificação, que são desativadas no fim.
   Atenção: o limite de login é de 10 por minuto para todos; o script espera sozinho e leva cerca de 6 minutos.
8. Desativar as contas internas de verificação (`ver.l16*`), montar o arquivo de acesso com
   `scripts/auditoria/montar-credenciais.py` e enviar ao autor com `SendUserFile`. A senha nunca vai no texto do chat
   nem na saída de comandos.
9. Entregar: URL HTTPS, horário de encerramento, resultado das verificações e como entrar.

## DESATIVAR (o Code executa, na ordem)
1. Parar o túnel: `docker rm -f siesal-tunel` (a URL deixa de funcionar na hora).
2. Remover a tarefa agendada: `Unregister-ScheduledTask -TaskName SIESAL-encerrar-tunel-auditoria -Confirm:$false`.
3. Voltar o cookie local: `AUTH_MODO_LOCAL=sim` no `.env` e `docker compose up -d api` (o acesso local por `http://localhost:18080` volta a manter o login).
4. Desativar as contas de auditoria (nada se apaga):
   `UPDATE usuario SET situacao='inativo', desativado_em=now() WHERE email LIKE 'auditoria.l16%'`.
5. Apagar `backups/credenciais-auditoria-L16.txt`.
6. Confirmar: `docker ps` sem `siesal-tunel`; só `127.0.0.1:18080` e `127.0.0.1:3000` publicados; PostgreSQL sem porta.

## Limites conhecidos (aceitos)
- A URL é pública e sem login na frente: quem a conhecer chega à tela de login. Proteções: bloqueio da conta por 15 minutos depois de 5 falhas
  e limite de 10 tentativas de login por minuto por endereço.
- Atrás do túnel, todos os visitantes aparecem com o mesmo endereço para o limite de tentativas: o limite de 10 por minuto é de todos juntos.
  O sistema não confia em `X-Forwarded-For` nem em `X-Real-IP` do cliente (o nginx sobrescreve); a Cloudflare recusa `CF-Connecting-IP` forjado com 403.
- O domínio `trycloudflare.com` também responde em HTTP simples e não envia HSTS. Como o cookie é `Secure`, não há sessão por HTTP: use sempre `https://`.
- Corrigida no L16a (08/11/2026): o cabeçalho `Permissions-Policy` não era enviado na página inicial (F-038 em `REGISTRO-DE-FALHAS.md`).
