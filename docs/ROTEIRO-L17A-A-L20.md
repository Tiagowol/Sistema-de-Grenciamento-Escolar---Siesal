# ROTEIRO OFICIAL — L17a AO L20 (FIM DA PARTE 1) E PARTE 2 — SIESAL 4.0 (09/11/2026, 21:55)

PARA O CODE: salve este arquivo como `docs/ROTEIRO-L17A-A-L20.md` no repositório, no primeiro commit autorizado, e registre as aprovações da seção 1 em `docs/REGISTRO-DE-APROVACOES.md` (registradas como A-031 e A-032). Este roteiro substitui, no que conflitar, o que o CLAUDE.md e o docs/PROXIMOS-PASSOS.md dizem sobre lotes.

## 1. Decisões aprovadas pelo proprietário (09/11/2026)
1. A numeração dos lotes **termina no L20**. Corrigir o CLAUDE.md, que diz "até o L21".
2. Depois do L20 é a **Parte 2**, em lista sem número (seção 5).
3. **L19 e L20 são Parte 1** e entram na entrega de **10/12/2026**. Pontos de controle: 20/11 e 01/12.
4. **Aprovados para execução** ("completo como planejado"): **L17a, L17b, L17c e L18**. Não é preciso novo "aprovo" para começá-los. Commit, push, merge e deploy continuam com autorização separada, como sempre.
5. **L19 e L20**: Planejados. Cada um só começa com "aprovo o L19" / "aprovo o L20".
6. Prazo: se apertar, o trabalho **para** e o escopo é cortado, por decisão do proprietário. Reavaliação em 20/11.
7. **Regra de registro:** toda alteração de plano, escopo, ordem ou decisão é registrada dos dois lados — o Code em `docs/` (REGISTRO-DE-APROVACOES.md e este roteiro) e o Claude do chat no Projeto do claude.ai. Mudança sem registro não vale.

## 2. Estado em 09/11/2026 (informado pelo Code)
- Ramo atual: `lote-18-fechamento`, criado a partir do L17 (commit `802dac8`). Nada enviado ao GitHub.
- L17 (apoio ao aluno) **Implementado**: linguagem curta, "Escolha o que fazer agora", pedido de ajuda; migração 0010, matriz v6; 647 testes unitários e 156 de integração. Falta: medição no navegador (360, 768, 1280 px), checagem humana do proprietário e revisão do NAPNE. Não bloqueia os próximos lotes.
- Pendências antigas que continuam valendo: F-033 (dívida do L14) e F-036 (não enviar o L15 sozinho ao GitHub).

## 3. Ordem de execução
**L17a → L17b → L17c → L18 → L19 → L20.** O ramo `lote-18-fechamento` já existe; o Code propõe como encaixar os ramos dos L17a–c (por exemplo, ramo `lote-17a-calendario` a partir do `802dac8`) antes de criar código. Regras de sempre: 1 a 3 itens por lote, escopo congelado, tempo concreto (L13), WCAG 2.2 AA e eMAG, sem ranking, matriz de permissões versionada com testes, RLS, auditoria append-only, backup antes de migração, falhas em `docs/REGISTRO-DE-FALHAS.md`, entrega em Feito/Falta/Sugestões, estados Implementado → Verificado.

### L17a — Calendário do aluno (M) — APROVADO
1. Tela **"Calendário"** no menu, logo abaixo de "Agenda", com 4 visões: dia, semana, mês e ano. Tempo concreto em todas: "hoje"/"amanhã" por extenso, data em dia/mês, prazo como fileira de quadrados, partes do dia (manhã, tarde, noite) com ícone. Teclado completo; leitor de tela anuncia a visão ativa.
2. O aluno **cria, edita e desativa** entradas próprias (prova, trabalho, lembrete, compromisso). **Mesma base de eventos da Agenda**: uma fonte de dados, duas formas de ver. Nada se apaga: desativar grava nova versão, com auditoria.
3. Preparação para importação (sem importar nada agora): campo `origem` em todo evento (`manual`, `google_agenda`, `google_sala_de_aula`, `calendario_escolar`) e identificador externo opcional. Evento importado terá selo da origem; o aluno não o edita, só oculta. O calendário escolar institucional chega no L19; as importações do Google, na Parte 2 — ambos preencherão o calendário automaticamente, sem mudar esta tela.
- Terminou quando: 4 visões funcionam nos 3 temas e com zoom 200%; criar/editar/ocultar por teclado; axe sem violações; teste de permissão (aluno só vê os próprios eventos e os da turma vinculada); migração com backup antes.

### L17b — Personalização (M) — APROVADO
1. Item **"Personalizar"** no menu: apelido de exibição, cor de destaque, tema (claro, escuro, alto contraste), tamanho da letra, reduzir movimento (`prefers-reduced-motion`), tela inicial (Meu dia, Agenda ou Calendário), botão "voltar ao padrão" e os liga/desliga já existentes (tempo visual do L13). Toda combinação passa por checagem de contraste mínimo: o sistema não deixa escolher combinação ilegível.
2. **Tipos de atividade do aluno**: criar tipos próprios com nome, cor e ícone (ex.: "leitura", "projeto", "treino"). Valem em Atividades e no Calendário. Cada aluno vê só os seus; sem compartilhamento e sem comparação.
3. **Preferências por usuário no banco** (hoje parte é só "neste aparelho"): o aluno troca de computador e mantém a aparência. Sem dado sensível; com auditoria; o padrão continua acessível para quem nunca personalizou.
- Terminou quando: preferência gravada e aplicada após novo login em outro navegador; contraste validado por teste automático; "voltar ao padrão" funciona; axe sem violações.

### L17c — Conta e suporte (G) — APROVADO
1. **Trocar senha** (só com a senha atual) e **trocar e-mail** (só com confirmação). Aluno menor de idade: a troca de e-mail exige aprovação do Responsável vinculado ou do Admin (decisão do proprietário, A-032).
2. **Encerrar conta**: desativa e **anonimiza** os dados pessoais (LGPD). Auditoria e notas oficiais não se apagam (append-only, hash preservado): ficam sem ligação com a pessoa. Aluno menor: confirmação do Responsável e, na falta dele, do Admin (A-032). Fluxo em duas etapas, linguagem literal, aviso claro do que acontece.
3. **Solicitar suporte**: formulário curto (assunto por lista + texto) que vira mensagem para o Pedagógico/Admin na base do L16. Sem anexo, sem link, com auditoria.
- Terminou quando: fluxos testados nos 5 perfis; conta encerrada não entra e não aparece em listas; auditoria e notas íntegras após anonimização; axe sem violações.

### L18 — Fechamento da Parte 1 (G) — APROVADO
1. **Login dos Masters**: entrada separada (`/operacao`), usuário da `operator_account` (vagas `w1lopes` e `tw1lopes`, pendentes e sem senha), senha definida no 1º acesso, TOTP obrigatório, cookie próprio, **sem nenhum acesso a dado escolar**. Decisão de arquitetura antes do código: o papel `siesal_ops` é NOLOGIN e a API não tem conexão para ele (`api/src/migrar/migrar.ts`, `api/migracoes/0003_operadores.sql`). A proposta do Code deve dizer como a API operará como `siesal_ops` sem acesso a tabelas escolares. Migração provável (0011), com backup antes e retorno escrito.
2. **Painel do Master mínimo**: só o que o L18 precisa para provar o login (ver a divisa com o L20 na seção 4).
3. **Fechamento**: verificação humana (leitor de tela, teclado, contraste, zoom, NAPNE), restauração de backup em banco limpo, README e documentos sem divergência, relatório de evidências do TCC, lista final do gate de verificação.

## 4. Divisa entre L18 e L20 (evitar sobreposição)
- **L18 (painel mínimo):** entrar como Master, ver a lista de instituições e criar/suspender instituição — só o necessário para provar login, TOTP e escopo "plataforma" da matriz.
- **L20 (painel real):** os 4 estados (em implantação, ativa, suspensa, encerrada), liga/desliga de módulos por instituição, trilha de auditoria do Master separada com contagens agregadas, e página de status pública.
- Se o Code discordar desta divisa, propõe outra em 1–2 linhas na proposta do L18. A decisão é do proprietário.

### L19 — Admin institucional completo (G) — Parte 1, PLANEJADO (começa com "aprovo o L19")
1. **Calendário escolar institucional**: o Admin cadastra períodos letivos, feriados e eventos; entram no Calendário dos alunos com `origem = calendario_escolar`. Versionado: alteração grava nova versão.
2. **Regras de notas versionadas**: períodos, pesos e arredondamento por instituição, com histórico e data de vigência. O lançamento do L15 passa a citar a versão da regra usada. Nada se apaga.
3. **Identidade visual da instituição**: nome de exibição, logotipo e cores, com validação automática de contraste (WCAG 2.2 AA). A personalização do aluno (L17b) sempre vence a da instituição.

### L20 — Painel Master real (G) — Parte 1, PLANEJADO (começa com "aprovo o L20") — ÚLTIMO LOTE
1. **Instituições e módulos**: 4 estados e liga/desliga de módulos por instituição (ex.: mensagens, calendário, apoio ao aluno). Módulo desligado some do menu daquela instituição.
2. **Auditoria do Master**: toda ação em trilha append-only separada da escolar. O Master vê só contagens agregadas por perfil; nunca nome, nota ou dado de aluno.
3. **Página de status independente**: pública, fora do aplicativo, estado dos serviços em linguagem literal, sem dado escolar e sem credencial.

## 5. Parte 2 (depois do L20) — lista sem número, nada aprovado
Importação CSV, XLSX e ICS; importação do Google Agenda e do Google Sala de Aula (preenchem o Calendário pelo campo `origem`); importação do calendário escolar externo; comunicados e logs de entrega; push e e-mail reais; PWA e Web Push; uptime externo e backups agendados; integrações (SUAP, se houver API e permissão); revisão LGPD e ECA com parecer, pentest, piloto e restauração em outra VPS; manual por perfil se cortado da Parte 1. Cada item vira lote com proposta e "aprovo" próprios quando a Parte 2 começar.

## 6. Risco de prazo (estimativa, não promessa)
Fila até 10/12: L16d, L16e (se aprovados), L17a, L17b, L17c, L18, L19, L20, mais as verificações humanas. É apertado. Ordem de corte sugerida, cada passo só com decisão do proprietário: (1) L17c para depois de 10/12; (2) L16e; (3) L20 item 3 e L19 item 3; (4) L17a sem visão por ano e L17b só com o item 1. Nunca cortar: segurança, defeito, L16a. Reavaliar em **20/11**.
