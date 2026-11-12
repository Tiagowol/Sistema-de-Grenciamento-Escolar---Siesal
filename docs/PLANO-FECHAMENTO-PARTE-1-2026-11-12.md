# PLANO DE FECHAMENTO DA PARTE 1 — SIESAL 4.0 (12/11/2026, 15:30)

**Resultado em uma linha:** o plano tem 13 lotes (L21a a L26c). Pela minha estimativa, eles **não cabem todos** até 10/12/2026. As integrações (SUAP, SIGEduc, Google) entram na Parte 1 só como **preparação desligada**, com dados fictícios. Nada foi executado. Nenhum lote está aprovado.

Estado deste documento: **Planejado** (só documento). Substitui o `PLANO-DE-CONCLUSAO-PARTE-1-2026-11-10.md` no que conflitar.

## 0. O que eu li e o que eu não consegui ler

Li:
- O chat de 12/11 e o `RELATORIO-CHAT-12-11.txt` que você mandou.
- No Projeto: estado real dos lotes (11/11), plano de conclusão (10/11), roteiro L17a–L20, mensagem ao Code (11/11).
- No GitHub, ramo `claude/f053-l20-verification-itcpd9`, commit `93ec6d0`: `CLAUDE.md`, as 23 migrações, a matriz de permissões v18, o registro de aprovações (até A-068), o registro de falhas (até F-056), `compose.yaml`, `web/seguranca.conf` e partes da API.
- Na internet: o que existe publicado sobre as APIs do SUAP, do SIGEduc, do Google Sala de Aula e do Google Agenda (fontes na seção 9).

Não consegui ler:
- `docs/PLANO-L21-A-L25.md` e os registros A-069 e A-070. **Eles não estão no GitHub** (o relatório diz "ainda sem commit"). Usei o resumo do relatório. Se a sessão do Code cair, esses 3 textos se perdem.
- A documentação oficial da API do SUAP (`suap.ifrn.edu.br/api/docs`): o site bloqueia leitura automática. O que escrevi sobre o SUAP vem de projetos públicos que usam a API. Precisa ser conferido por alguém logado no SUAP.
- O retorno do NAPNE e do professor de 12/11: não achei registro em nenhum documento.

## 1. Mudanças de escopo que este plano faz (precisam do seu registro)

1. **Numeração.** A decisão de 09/11 dizia "os lotes terminam no L20; depois é Parte 2". Com L21 em diante, isso muda. O `CLAUDE.md` ainda diz "lotes de L13 a L20".
2. **Integrações.** O papel do projeto diz que SUAP e Google ficam na Parte 2. Você pediu para deixar preparado agora. Minha proposta: na Parte 1 entra a **camada de conectores desligada** (telas, chaves de ligar, banco, conector fictício). Chamada real com dado real continua na Parte 2. Motivo em 1 linha: as 4 integrações dependem de autorização de terceiros que não chega antes de 10/12 (seção 3).
3. **Nomes dos lotes.** Mantive L21a, L21b, L22a–c, L23a–b, L24 e L25 como no relatório, para não confundir. Acrescentei **L21c** (segredos e backup) e **L26a–c** (integrações). A ordem de execução **não** segue o número; está na seção 5.

## 2. Falhas e lacunas encontradas

Marcação: **[fato]** = conferi no código ou em documento. **[a conferir]** = não confirmei.

### 2.1 Lógica de negócio

| # | Lacuna | Onde resolver |
| --- | --- | --- |
| N1 | **[fato]** Hoje uma pessoa pertence a **uma** instituição e tem **um** perfil (tabela `usuario`, e-mail único por instituição). Você decidiu que professor e pedagogo podem estar em várias instituições e em alunos isolados. O banco não permite isso. Não existe "pessoa" acima das instituições nem troca de espaço. | L22a |
| N2 | **[fato]** O aluno isolado é uma instituição do tipo "individual". Nesse espaço não existe Admin. Ficam sem destinatário: pedido de suporte, decisão sobre conta de menor (troca de e-mail, encerrar conta) e atendimento de pedido de ajuda. | L22a (decisão sua) |
| N3 | **[fato]** O Responsável do aluno isolado só clica num link que ativa a conta do aluno. Ele **não tem conta**. Não consegue acompanhar, revogar a autorização nem aprovar nada depois. | L22a |
| N4 | Falta a regra: **quem convida** o professor ou o pedagogo de um aluno isolado, e **quem autoriza** quando o aluno é menor. Um adulto vai ver dados de um menor; a autorização do Responsável precisa existir e ficar registrada. | L22a (decisão sua) |
| N5 | Falta a regra de mudança: aluno isolado entra numa instituição, ou sai dela. Os dados vão junto, ficam, ou o aluno fica com os dois espaços? | L22a (decisão sua) |
| N6 | **Conflito de regras.** A "árvore do Master" mostra admins, professores, alunos e responsáveis. O papel do projeto e o L20 dizem: Master sem acesso a dado escolar, só contagens, "nunca nome". Nome de aluno menor é dado pessoal. | L22b (decisão sua) |
| N7 | **Duas fontes de nota.** Existe a nota oficial lançada no SIESAL (L15) e existirá a nota importada do SUAP ou do SIGEduc. Falta a regra de qual vale. Proposta: a importada é cópia só de leitura, com selo de origem e data; não vira nota oficial do SIESAL; revisão se pede no sistema de origem. | L26a |
| N8 | **Demonstração.** "Sair da demonstração e nunca voltar" conflita com precisar mostrar o sistema à banca depois. Também não está decidido se a chave por instituição continua. Proposta: demonstração é uma **instalação separada** (outro banco), não um modo dentro do banco real. | L23b |
| N9 | **Autenticação por papel.** O Pedagógico vê a dificuldade do aluno (dado sensível) só com senha. "Master e Admin = e-mail + autenticador + senha" não deixa claro se o e-mail é fator de login ou só o nome de usuário. | L23a |
| N10 | A dificuldade (0 a 10) é lida pelo Pedagógico com escopo "instituição". No aluno isolado, a regra D3 diz "só o vínculo". O aviso "a equipe vê esta nota" só aparece com o módulo ligado. Precisa ser conferido no espaço individual. | L22a |

### 2.2 Segurança

| # | Falha ou risco | Onde resolver |
| --- | --- | --- |
| S1 | **[fato]** A chave do CPF (`CPF_CHAVE`) em uso foi colada no chat (A-063). Hoje há 0 CPFs no banco, então trocar é seguro. Depois do primeiro CPF, trocar exige recifragem, que não existe. | L21c |
| S2 | **[fato]** F-056: a API responde "criado" antes de gravar. Só os testes foram contornados. | L21a |
| S3 | **[fato]** Sem HSTS. O acesso externo é por túnel. O cookie fica sem "Secure" quando `AUTH_MODO_LOCAL` está ligado. **[a conferir]** qual valor está no `.env` do site externo. | L21a |
| S4 | **[fato]** Os backups (`backups/*.dump`) não são cifrados e a mesma pasta guarda os arquivos de convite do Master. **[fato]** A restauração foi ensaiada uma vez no L18, com 13 migrações; hoje são 23. | L21c |
| S5 | **[fato]** O bloqueio de login é por conta (5 falhas, 15 minutos). Quem souber o e-mail de um aluno consegue travar a conta dele de propósito. **[a conferir]** se existe limite por endereço de rede. | L21a |
| S6 | **[fato]** F-054: migração que mexe em dado escolar roda sem enxergar as linhas (RLS forçada) e termina "com sucesso" sem mudar nada. O L22a mexe em dados existentes. | L22a: teste obrigatório em banco com dados |
| S7 | **[fato]** F-052: o Norton quebra a reconstrução da imagem. O contorno é manual a cada aplicação. | L21c (decisão sua: liberar o Docker no Norton) |
| S8 | **Risco novo das integrações.** O SIESAL passará a guardar chaves de acesso (tokens) do SUAP e do Google. Com elas, quem invadir o SIESAL lê dados do aluno **fora** do SIESAL. Regras propostas: token cifrado com chave própria; só permissão de leitura; nunca em log nem em auditoria; revogado ao desconectar e ao encerrar a conta. | L26a |
| S9 | **Nunca pedir no SIESAL a senha do SUAP ou do SIGEduc.** A API antiga do SUAP aceita matrícula e senha; esse caminho não será usado. Só o login na página do próprio SUAP (OAuth2). | L26b |
| S10 | Endereços dos conectores ficam fixos no código. Admin e Master só ligam e desligam; não digitam endereço. Evita que o servidor seja usado para acessar endereços internos. | L26a |
| S11 | Teste automático de injeção de SQL em todas as rotas que recebem texto ainda não existe. | L21a |

### 2.3 Processo

| # | Falha | Correção proposta |
| --- | --- | --- |
| P1 | **[fato]** O trabalho atual (migrações 0018 a 0023) está num ramo fora do padrão (`claude/f053-l20-verification-itcpd9`). O `siesal-4` está atrás. Os 4 ramos `lote-20*` não foram unidos. | Portão G0, antes do L21a (seção 5) |
| P2 | **[fato]** `PLANO-L21-A-L25.md`, A-069, A-070 e o relatório de 12/11 não estão no GitHub. | G0 |
| P3 | **[fato]** O `CLAUDE.md` diz "não faça commit" e "lotes de L13 a L20". O Code fez commit a seu pedido e os lotes passaram do L20. O arquivo que o Code lê primeiro está errado. | G0 |
| P4 | **[fato]** O Projeto do claude.ai tinha o registro até A-046; o repositório está em A-068 (mais A-069 e A-070 sem commit). A regra "registrar dos dois lados" não está sendo cumprida. | Todo lote termina com um "estado real" copiado para o Projeto |
| P5 | **[fato]** Nenhum lote desde o L16 é "Verificado". São mais de 15 lotes só "Implementado". Se a checagem humana achar defeitos em dezembro, não há folga. | L24 dividido em 3 sessões curtas (seção 5) |
| P6 | Retorno do NAPNE e do professor (12/11) sem registro. | Você me diz o que eles pediram; eu registro |
| P7 | **[fato]** L16d e L16e constam como commitados e "Implementado". **[a conferir]** o item 3 do L19 e o item 3 do L20 no site. | Conferir em G0 |

### 2.4 Fluxo (regras que faltam para as integrações)

1. **Autorização.** Aluno menor só conecta conta do SUAP ou do Google com autorização do Responsável (mesmo tipo de link do 20c-2), com versão do termo registrada.
2. **Importado é só leitura.** Tem selo da origem. O aluno oculta, não edita.
3. **Mudou na origem:** grava nova versão. **Sumiu na origem:** marca "removido na origem"; não apaga.
4. **Desconectar:** para de importar e oculta o que veio de fora. Apagar é escolha da pessoa.
5. **API de fora parada:** o SIESAL continua funcionando e mostra "última atualização em dia/mês".

## 3. As 4 APIs: o que consegui confirmar

| Sistema | Como entra | Traz notas? | Traz professores? | Traz pedagogos? | O que falta para ligar de verdade |
| --- | --- | --- | --- | --- | --- |
| **SUAP (IFRN)** | Login na página do SUAP (OAuth2). A aplicação é cadastrada no SUAP por uma conta autorizada do IFRN. | Sim: boletim do próprio aluno (notas, faltas e situação por disciplina). Também períodos letivos, próximas avaliações, turmas virtuais com horário e local, e eventos. | **A confirmar.** Não achei lista de professores. Diários podem exigir perfil de professor. | **Não achei.** | Cadastro da aplicação pelo IFRN; conferir na documentação oficial quais dados o OAuth2 libera; autorização para dado oficial. |
| **SIGEduc (RN)** | **Não achei API pública nem documentação para desenvolvedor.** O sistema é da empresa ESIG com a SEEC/RN e tem aplicativos próprios de estudante, professor e família. | Sem API, não. | Não. | Não. | Pedido formal à SEEC/RN e à ESIG. Sem resposta deles, não existe integração. |
| **Google Sala de Aula** | Login Google (OAuth2), por pessoa. | Sim: atividades e notas da própria pessoa nas turmas dela. | Lista de participantes da turma (permissão própria). | Não existe esse papel no Google. | Verificação do aplicativo pelo Google (semanas). Conta escolar de menor de 18: o administrador do Google da escola precisa liberar o aplicativo. Em modo teste: até 100 pessoas e a autorização vence em 7 dias. |
| **Google Agenda** | Login Google (OAuth2), por pessoa. | Não se aplica. | Não se aplica. | Não se aplica. | As permissões de leitura da agenda são "sensíveis": exigem a verificação do Google. Mesmos limites do modo teste. |

Conclusões:
1. **Nenhuma das 4 APIs entrega "a escola inteira" para um sistema de fora.** SUAP e Google funcionam por pessoa: cada aluno conecta a própria conta. Isso serve igual para aluno de instituição e para aluno isolado. Preencher professores e pedagogos sozinho, pela API, **não é possível hoje** com o que confirmei.
2. **"Opção na instituição"** vira: o Master libera o conector para a instituição; o Admin liga; cada pessoa conecta a própria conta. **"Opção no aluno isolado"** vira: o Master libera para o espaço individual; o aluno (com o Responsável, se menor) conecta.
3. **O que já existe no banco [fato]:** eventos com origem `google_agenda`, `google_sala_de_aula` e `calendario_escolar`, com identificador externo; disciplina do aluno com origem `escola` e `suap`. **Não existe:** origem `sigeduc`, tabela de conexões, guarda de tokens, telas.
4. **Para a conta de demonstração (18 anos)** dá para testar SUAP e Google de verdade, se o IFRN cadastrar a aplicação e a conta Google for pessoal ou liberada. Para menores, só depois do parecer jurídico.

## 4. Os lotes

Cada lote tem de 1 a 3 itens e precisa do seu "aprovo" próprio.

### Prioridade 1 — segurança e defeito
- **L21a — Endurecimento.** (1) HSTS pronto, ligado só com HTTPS. (2) Teste automático de injeção de SQL nas rotas com texto. (3) Causa do F-056 corrigida e contorno retirado dos testes. Conferências sem código novo: S3 e S5.
- **L21c — Segredos e backup (novo).** (1) Trocar a `CPF_CHAVE` por uma que nunca apareceu em chat. (2) Restauração de backup em banco limpo com as 23 migrações, e convites do Master fora da pasta de backups. (3) Procedimento fixo para o Norton (F-052), ou a sua liberação.
- **L21b — Calendário.** Grade e lista; o aluno escolhe e a escolha fica salva.

### Prioridade 2 — bloqueia a entrega
- **L22a — Pessoas e vínculos.** (1) "Pessoa" única que participa de vários espaços (instituições e alunos isolados), com troca de espaço na tela. (2) Cadastro próprio de professor e pedagogo sem instituição (A-070). (3) Conta de Responsável no espaço individual. Mexe em banco e RLS. **Proposta escrita antes de qualquer código**, com N2, N4 e N5 como perguntas fechadas.
- **L26a — Base das integrações (novo).** (1) Tabelas de conector e de conexão, token cifrado, origem `sigeduc` e `suap` nos eventos. (2) Chaves de ligar: Master por instituição e por espaço individual; Admin na instituição; pessoa na própria conta. (3) Conector fictício, para testar tudo sem internet e sem dado real. Depende do L22a.
- **L22b — Árvore do Master.** Só leitura, menu das áreas e indicador teste/produção. Depende da sua decisão N6.
- **L22c — Admin e convites.** (1) Admin cria e desativa só os da própria instituição. (2) Revogar convite, com auditoria. (3) Manual automático por tipo de destinatário.
- **L23a — Autenticação por papel.** (1) Política por papel, configurada pelo Master. (2) Código de uso único por e-mail como 2º fator.
- **L26b — Conectores SUAP e SIGEduc (novo).** (1) SUAP por OAuth2: código pronto, **desligado** até o IFRN cadastrar a aplicação. (2) SIGEduc: só a opção na tela, com o estado "aguardando acordo com a SEEC/RN".
- **L26c — Conectores Google (novo).** (1) Agenda, só leitura. (2) Sala de Aula, só leitura. Os dois **desligados**; teste só com a conta de demonstração.
- **L23b — Modo demonstração.** Proposta própria antes do código (N8).
- **L24 — Verificação humana.** Em 3 sessões: até 20/11 (L16 a L20d), até 01/12 (L21 e L22), até 08/12 (o resto).

### Prioridade 3 — melhoria
- **L25 — Documentos de privacidade.** RIPD, Política e Mapa de Riscos, com: dificuldade vista pelo Pedagógico, CPF, vínculos múltiplos, integrações e demonstração. Obrigatório antes de qualquer dado real.

## 5. Ordem e datas (estimativa minha, não medida)

**G0 — antes de tudo (não é lote; precisa da sua autorização):** levar ao GitHub o plano, A-069, A-070 e o relatório; decidir o merge em `siesal-4`; corrigir o `CLAUDE.md`.

| Quando | O que | Depende de você |
| --- | --- | --- |
| 12/11 a 14/11 | G0, L21a, L21c | Aprovar; decidir o Norton |
| 15/11 a 20/11 | L21b; proposta e execução do L22a; **1ª sessão de checagem humana** | Decidir N2, N4, N5; fazer a checagem |
| **20/11** | **Ponto de controle: reavaliar o corte** | |
| 21/11 a 26/11 | L26a, L22b, L22c | Decidir N6 |
| 27/11 a 01/12 | L23a, L26b; **2ª sessão de checagem humana** | Decidir N9; pedir ao IFRN o cadastro da aplicação |
| **01/12** | **Ponto de controle** | |
| 02/12 a 07/12 | L26c **ou** L23b (só um dos dois cabe); L25 | Escolher |
| 08/12 a 10/12 | 3ª sessão de checagem; restauração final; relatório de evidências do TCC; merge final | Autorizar o merge |

**Não cabe tudo.** Ordem de corte que eu sugiro, cada passo só com a sua decisão: (1) L23b para depois de 10/12; (2) L26c; (3) o item 2 do L23a; (4) o item 3 do L22c. **Nunca cortar:** L21a, L21c, L22a, L24 e L25.

## 6. Decisões que dependem de você

Vou perguntar **uma por mensagem**, na hora de cada lote. Lista completa, para você pensar antes:

1. **Agora:** aprovar G0 e o L21a.
2. **L21c:** liberar o Docker no Norton, ou manter o contorno manual.
3. **L22a (N4):** quem convida o professor ou pedagogo do aluno isolado.
4. **L22a (N2):** quem decide pelo menor no espaço individual, já que não há Admin.
5. **L22a (N5):** o que acontece quando o aluno isolado entra numa instituição.
6. **L22b (N6):** o que o Master vê na árvore: nomes ou só contagens.
7. **L23a (N9):** o Pedagógico e o Professor passam a ter 2º fator obrigatório?
8. **L23b (N8):** demonstração como instalação separada, ou como modo dentro do sistema.
9. **L26b:** quem pede ao IFRN o cadastro da aplicação no SUAP, e quem escreve à SEEC/RN sobre o SIGEduc.
10. **Reservar as 3 datas** da checagem humana (com o NAPNE).
11. **O retorno de 12/11** do NAPNE e do professor: o que eles pediram.

## 7. Riscos

- **Prazo [estimativa]:** 28 dias corridos para 13 lotes, 3 sessões de checagem e o fechamento. O L22a é o maior risco: muda a base de quem é quem no sistema.
- **Terceiros [fato]:** IFRN, SEEC/RN e Google não têm prazo comigo nem com você. Por isso os conectores ficam desligados e não bloqueiam a entrega.
- **Dados de menores [fato]:** tudo continua fictício. Token real de conta de menor só depois do parecer jurídico. Sigo dizendo "projetado para atender".

## 8. Feito, Falta, Sugestões

**Feito:** leitura do chat, do relatório, do Projeto e do repositório (commit `93ec6d0`); pesquisa das 4 APIs; 10 lacunas de negócio, 11 de segurança, 7 de processo e 5 regras de fluxo listadas; 13 lotes definidos com ordem, datas e corte.
**Falta:** sua aprovação de G0 e do L21a; conferir a documentação oficial do SUAP com uma conta logada; as 11 decisões da seção 6; o Code copiar este plano para `docs/` (regra dos dois lados).
**Sugestões:** aprovar G0 e o L21a juntos; reservar já as 3 datas da checagem humana; pedir ao IFRN o cadastro da aplicação no SUAP ainda nesta semana, porque não depende de código.

## 9. Fontes

- SUAP, OAuth2 e `/api/rh/eu/`: https://github.com/fcobraulio/autopei
- SUAP, cadastro de aplicação OAuth2: https://github.com/pietrobrb/ExpotecIFCN-2026 e https://github.com/albalopes/licenciaturazn
- SUAP, dados de ensino disponíveis: https://github.com/kellyson71/suapy
- SUAP, API antiga com matrícula e senha (não usar): https://github.com/ivmelo/suap-api-php
- SUAP, clientes do IFRN: https://github.com/IFRN/suapi
- SIGEduc, origem e aplicativos: https://site.esig.com.br/2012/10/01/sigeduc-entra-em-producao-nas-escolas-estaduais-de-natal/ e https://play.google.com/store/apps/details?id=br.gov.rn.sigeduc.mobile
- Google Sala de Aula, permissões: https://developers.google.com/workspace/classroom/guides/auth
- Google Sala de Aula, menores de 18: https://developers.google.com/workspace/classroom/guides/key-concepts/admin-actions e https://support.google.com/a/answer/13437370
- Google, verificação e prazo: https://developers.google.com/classroom/best-practices/access-control-enhancements
- Google Agenda, permissões: https://developers.google.com/calendar/api/auth
- Google, limites do modo teste: https://nango.dev/docs/api-integrations/google-shared/google-security-review
