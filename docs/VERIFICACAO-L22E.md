# VERIFICAÇÃO DO L22e — Auditoria do Admin da escola (14/11/2026)

Estado do lote: **Implementado (código no computador, sem commit de código), não aplicado no site, não Verificado.** Falta a checagem humana do autor (leitor de tela, teclado, contraste, NAPNE). Sem migração; sem mudança na matriz de permissões (a regra `auditoria.ler` do Admin já existia). Origem: A-111, A-117 (proposta), A-118 (Q1 = B) e o "Aprovo" do autor em 14/11/2026.

## 1. O que foi feito
- **API:** `GET /auditoria` (`api/src/auditoria/rotas.ts`), só para o Admin com sessão completa. Lê só a cadeia da própria instituição (RLS). 50 registros por vez, `?antes=<número>` pede os mais antigos. Devolve frase, nome, perfil e data; nunca `antes`/`depois`.
- **Filtro (lista permitida, deny by default):** só ações administrativas (conta criada, desativada, reativada, senha provisória; turmas, disciplinas, vínculos; calendário da escola; regras de notas; identidade; avisos; instituição criada por convite; leitura da auditoria) e **entrada, falha de entrada, bloqueio e saída da equipe** (Q1 = B). Vale **só quando quem fez é Admin, Professor ou Pedagógico**, conferido no banco (junção com `usuario`). Fora: tudo do aluno, todo `auth.*` de aluno, responsável e pessoa, ator `anonimo`, `nota.*` e pedidos de revisão.
- **Leitura registrada:** abrir a primeira página grava `auditoria.leitura` (quem e quando); as páginas seguintes não. Acesso negado grava `auditoria.acesso_negado` e não aparece na lista.
- **Cadeia:** a faixa "Cadeia íntegra: sim/não" usa `auditoria_verificar()` (só na primeira página).
- **Tela:** "Auditoria" no menu do Admin (`web/src/paginas/AuditoriaEscola.tsx`), cartões que quebram o texto (sem tabela larga), "Ver registros mais antigos", tempo como "hoje, 14/11 · tarde (15:32)". Tópico novo na Ajuda do Admin (fora dos Primeiros passos). Versão do sistema: lote L22e.

## 2. Decisão que estreitou a proposta (avisar o autor)
A proposta dizia "autorização do responsável" e "criação de aluno" entre os eventos visíveis. Como a regra ficou "só equipe é quem fez", `responsavel.autorizou`, `representante.aluno_criado` e `conta.criada_aguardando_responsavel` **não aparecem** (quem faz é o responsável ou o aluno). É mais restritivo e mais seguro; mostrar esses eventos exigiria outra regra e outra decisão sua.

## 3. Verificação por máquina
| Verificação | Resultado |
| --- | --- |
| Integração (banco temporário, migrações reais) | 400 de 400, 32 arquivos (7 testes novos da auditoria) |
| Testes de tela e shared | 1418 de 1418, 42 arquivos (inclui axe da tela nova) |
| Tipos (api, web, shared) | sem erro |
| Lint dos 13 arquivos do lote | 0 erros; 1 aviso antigo de CSS (especificidade), que não é do lote. O lint do repositório inteiro não foi refeito (já tinha erros antigos). |

Os 7 testes de integração cobrem: o Admin vê contas, turmas e entradas da equipe em frases e a cadeia íntegra; eventos de aluno, de responsável, anônimos e de ação fora da lista **não saem**; `antes`/`depois` não saem; uma instituição não vê a outra; professor, pedagógico e responsável recebem 403 e sem sessão 401; a leitura é gravada só na primeira página; paginação de 50 em 50 e parâmetro inválido (400); cadeia adulterada aparece como "não íntegra". Um teste de matriz confirma que só o Admin tem `auditoria.ler` na instituição.

## 4. Conferência na tela (360, 768 e 1280 px)
Como na conferência do L22c: **código e CSS reais** num servidor temporário (porta 5174, removido) com **API simulada** e dados fictícios; o site no ar e o banco não foram tocados. axe 4.14.0 com contraste ligado, teclado (Tab e Enter de verdade), foco, alvos de 44 px e rolagem horizontal.

| Largura | Rolagem horizontal | Alvos de 44 px | axe causado pelo L22e |
| --- | --- | --- | --- |
| 360 px | não | sim | nenhum |
| 768 px | não | sim | nenhum |
| 1280 px | não | sim | nenhum |

- Nome longo e perfil quebram em cartões; sem tabela, **sem a falha F-059**.
- Teclado: "Ver registros mais antigos" aciona com Enter, soma 50 registros e **mantém o foco com anel visível**.
- **Defeito meu, achado e corrigido nesta sessão:** o botão ficava `disabled` durante o carregamento e o foco ia para o início da página. Troquei por `aria-disabled` e repeti o teste (foco mantido). Também dei espaço entre a faixa de integridade e a lista (estava colada).
- "Cadeia íntegra: não" aparece em aviso de alerta (`role="alert"`).
- Achados antigos que o axe repete em todas as telas (não são do L22e): contraste 4,42:1 do subtítulo `#64748b` sobre `#f4f7fb` e `region` da faixa "Ambiente de teste".

## 5. O que NÃO foi conferido
- Leitor de tela, contraste a olho, NAPNE (checagem humana do autor).
- Fluxo com a API real e o Admin real com segundo fator (os testes de integração cobrem a API; esta conferência cobre a tela).
- Nenhum envio ao site no ar: o contêiner `web` e a API do site ainda **não** têm o código do L22e. Para ver no site, é preciso reconstruir (`docker compose up -d --build`) e depois reiniciar o proxy; isso é deploy local e fica com a sua autorização.

## 6. Arquivos do lote (para o seu commit; sem `git add .`)
`api/src/app.ts`, `api/src/auth/politica.ts`, `api/src/auditoria/rotas.ts`, `api/src/auditoria/rotas.integracao.test.ts`, `shared/src/permissoes.test.ts`, `web/src/App.tsx`, `web/src/api.ts`, `web/src/componentes/Shell.tsx`, `web/src/estilos/extra.css`, `web/src/manual.ts`, `web/src/versao.ts`, `web/src/l22e.test.tsx`, `web/src/paginas/AuditoriaEscola.tsx`.

## Feito, Falta, Sugestões
**Feito:** API, filtro, tela, menu, Ajuda, 7 testes de integração, testes de tela e de matriz, conferência nas 3 larguras.
**Falta:** seu commit de código; sua autorização para reconstruir o site (deploy local); checagem humana; Admin real vendo a tela.
**Sugestões:** commitar o código do L22e em commit separado do L22c; depois, a proposta do L22f; lote pequeno de defeito para F-059 e o contraste.

## Como voltar
- Código: não há commit de código ainda; para desfazer, apagar os arquivos novos e reverter os 9 arquivos alterados (`git checkout -- <arquivo>`), ou, depois do seu commit, `git revert <commit>`.
- Banco: nada a desfazer (sem migração). Os eventos `auditoria.leitura` gravados na cadeia ficam (a auditoria é append-only).
