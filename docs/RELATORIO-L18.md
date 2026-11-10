# Relatório do L18 — Fechamento da Parte 1, com login dos Masters (10/11/2026)

**Resultado: o L18 está Implementado e aplicado no site local. Não está "Verificado": falta a checagem humana.**

Feito em 10/11/2026, das 06:40 às 07:04, na sessão normal. A tarefa agendada para 01:00 não rodou (F-043).
Ramo: `lote-18-masters-fechamento`, criado a partir do `lote-17c-conta-suporte` (`1453fca`). Sem push.

## Feito

### 1. Login dos Masters (`/operacao`)
- Entrada separada em `http://localhost:18080/operacao`. Sem menu da escola.
- Primeiro acesso: usuário + convite de uso único (30 minutos) + senha nova de 12 caracteres ou mais.
- TOTP obrigatório: sem ele não existe sessão completa. Sessão de 1 hora. Cookie próprio (`__Host-siesal_operacao`).
- 5 falhas seguidas bloqueiam por 15 minutos. Limite de 10 tentativas por minuto por IP.
- A API age como o papel `siesal_ops` só dentro de uma transação. Esse papel não lê nenhuma tabela escolar. Explicação e provas: `docs/PROPOSTA-L18-ARQUITETURA-MASTER.md`.
- **Nenhuma senha de Master foi criada.** As 2 vagas continuam pendentes e sem senha (conferido no banco).

### 2. Painel mínimo
- Lista as instituições (nome, situação, data de criação). Cria, suspende e reativa.
- Suspender tem efeito real: as pessoas da instituição não entram e as sessões abertas deixam de valer.
- Não mostra número de alunos, nomes nem notas.

### 3. Fechamento
- Migração `0014_masters.sql` aplicada, com backup antes. Retorno escrito em `docs/RETORNO-0014.md`.
- Restauração ensaiada em banco temporário (não no banco do site): `pg_restore` terminou sem erro e as contagens bateram com o banco do site (13 migrações, 28 tabelas, 35 usuários, 169 eventos de auditoria, 29 políticas de RLS, 2 instituições). O banco temporário foi apagado.
- README, `PROXIMOS-PASSOS.md`, registro de aprovações (A-034) e registro de falhas (F-043, F-044, F-045) atualizados.
- Matriz de permissões: continua na versão 9. A permissão do Master (`instituicoes.criar_suspender`) já existia.

### Backups
| Quando | Arquivo | Para quê |
|---|---|---|
| 09/11, 22:33 | `backups/siesal-20261109-223319.dump` | antes das migrações 0011, 0012 e 0013 |
| 10/11, 06:54 | `backups/siesal-20261110-065416.dump` | antes da migração 0014 |

### Comandos executados e resultado
| Comando | Resultado |
|---|---|
| `bash scripts/backup.sh` | backup feito, com `.sha256` |
| `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate` | `aplicada 0014_masters.sql` |
| `docker compose up -d --build` | api, db e proxy saudáveis; web no ar |
| `bash scripts/manutencao.sh estado` | modo `auto`, janela 06:00-23:59, resposta 200 (aberto) |
| `docker compose --profile teste run --rm --build teste` | 15 arquivos, **205 testes de integração passando** |
| lint, tipos e testes unitários (contêiner `node:26`) | tipos sem erro; **773 testes unitários passando**; lint com 1 aviso antigo (`api/src/conta/rotas.ts:344`, do L17c) |

### Testes novos do L18
- Integração (`api/src/operacao/operacao.integracao.test.ts`, 18 testes): primeiro acesso, convite errado, vencido e reutilizado; TOTP obrigatório; código repetido recusado; bloqueio e limite por IP; painel; suspensão derruba login e sessão escolar; **como `siesal_ops`, toda tabela escolar responde "permission denied"**; cookie da escola não entra em `/operacao` e o do Master não entra na escola; trilha do Master append-only, com cadeia de hash íntegra e sem senha, convite ou código.
- Tela (`web/src/operacao.test.tsx`, 5 testes): login, primeiro acesso, TOTP e painel, com axe sem violações.

### Navegador (navegador embutido do Claude, motor do Chrome)
| Tela | 360 px | 768 px | 1280 px |
|---|---|---|---|
| `/operacao` (entrar e primeiro acesso) | sem rolagem horizontal; alvos de 44 px ou mais | igual | igual |
| Calendário (dia, semana, mês, ano) | sem rolagem horizontal; **dias do mês com 38 px de largura** | passa | passa |
| Personalizar | passa (depois da F-044) | passa | passa |
| Minha conta | passa (depois da F-044) | passa | passa |
| Atividades | passa | passa | passa |
| Agenda | sem rolagem horizontal; **dias com 39 px de largura** | passa | passa |

- Medido com uma conta fictícia criada só para isso (`ver.l18.aluno@exemplo.invalid`), já desativada. As contas `@teste.com` do autor não foram usadas nem alteradas.
- Achados corrigidos: **F-044** (botões de 36 px, campos de 43 px e controles pequenos em Personalizar) e **F-045** (tamanho do texto no celular).
- No site real, um login errado em `/operacao` gravou o evento na trilha do Master e a cadeia conferiu.

## Falta

**PODE TESTAR NO CELULAR: sim.**
- Endereço: o mesmo de ontem. Na rede de casa, o endereço local do computador na porta 18080. Fora de casa, só com o acesso público ligado; se ele não abrir, diga "ativar acesso público temporário" (eu não liguei nem desliguei nada).
- Como entrar: `aluno@teste.com` com a sua senha. Feche a aba e abra de novo antes, para não pegar a versão antiga.
- O que olhar: (1) o tamanho da letra no Firefox e no Chrome ficou igual? (2) Calendário, Personalizar e Minha conta abrem? (3) `/operacao` mostra a tela "Entrar na operação"?

### Depende do autor
1. **Primeiro acesso do Master** (só você faz). No terminal WSL, trocando `nome` pelo seu usuário de Master:

```
MASTER_USUARIO=nome docker compose --profile release run --rm convite-master
```

   Terminou quando: o terminal mostra um convite de 20 letras e números. Depois: abrir `/operacao`, "Primeiro acesso: tenho um convite", definir a senha e ativar o segundo fator no aplicativo de autenticação.
2. Confirmar as 6 decisões do Code listadas em `docs/REGISTRO-DE-APROVACOES.md` ("Decisões do Code no L18").
3. Confirmar no celular se a F-045 foi resolvida. Se não, mandar 1 captura de cada navegador.
4. Decidir a exceção da F-044: dias do mês com 38 a 39 px de largura em 360 px.
5. Push do ramo (não feito). Comando:

```
git push -u origin lote-18-masters-fechamento
```

6. Merge e deploy fora do computador: não feitos; cada um pede autorização própria.

### Gate de verificação (o que impede dizer "Verificado")
| Checagem humana | L17 | L17a | L17b | L17c | L18 |
|---|---|---|---|---|---|
| Leitor de tela (NVDA ou TalkBack) | falta | falta | falta | falta | falta |
| Só teclado (Tab, Enter, Esc) | falta | falta | falta | falta | falta |
| Contraste real nos 3 temas | falta | falta | falta | falta | falta |
| Zoom de 200% | falta | falta | falta | falta | falta |
| Celular real (Firefox e Chrome) | falta | falta | falta | falta | falta |
| Revisão do NAPNE (textos e fluxo) | falta | falta | falta | falta | não se aplica |
| Fluxo completo do Master com aplicativo de autenticação real | — | — | — | — | falta |

Não medido por mim no navegador: temas escuro e alto contraste, zoom de 200%, sino de suporte (Pedagógico e Admin), painel do Master com sessão (exige o primeiro acesso do autor). Os testes automáticos cobrem esses fluxos, mas não substituem a medição.

### Pendências que continuam
- **F-033** (dívida do L14) e **F-036** (não enviar o L15 sozinho ao GitHub).
- L17c: aviso no sino para Responsável e Admin decidirem pedidos do menor; confirmar "menor = perfil aluno"; texto dos pedidos de revisão do L15 não é limpo na anonimização (precisa de parecer jurídico).
- Parecer jurídico (LGPD e ECA Digital): sem ele, o texto correto é "projetado para atender".
- Relatório de evidências do TCC: este relatório e os planos em `docs/` são a base; a redação final para o TCC não foi feita.
- Instituição criada pelo painel do Master nasce sem Admin (o primeiro Admin continua pelo job `instituicao`).

## Sugestões
1. Antes do L19, fazer a checagem humana do L17a ao L18 de uma vez (cerca de 1 hora, estimativa), com o NAPNE na parte do aluno.
2. No L20: mensagem própria na tela de login quando a instituição está suspensa; criar o primeiro Admin a partir do painel, por um caminho que não dê acesso escolar ao Master.
3. Endurecimento antes de piloto (Parte 2): papel de login separado para a operação (alternativa descrita na proposta de arquitetura).
4. Incluir `backups/` na lista de pastas ignoradas pelo Biome, para `pnpm lint` não ler arquivos fora do git.
5. Tarefas agendadas: só usar depois de um teste com o autor presente (F-043).

## Estados
| Lote | Estado |
|---|---|
| L17, L17a, L17b, L17c | Implementado (migrações 0010 a 0013 aplicadas) |
| L18 | Implementado (migração 0014 aplicada) |
| L19, L20 | Planejado (cada um só começa com "aprovo o L19" / "aprovo o L20") |
