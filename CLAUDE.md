# SIESAL 4.0 — instruções para o Claude Code

Leia este arquivo inteiro antes de qualquer ação. Responda sempre em PT-BR.

## 1. O que é
Sistema Inteligente de Estudos, Agenda e Aprendizagem. Sistema escolar inclusivo e multi-instituição, feito como TCC (IFRN Canguaretama) e simulado como SaaS real. Apoia alunos com dificuldades de aprendizagem, incluindo TEA e TDAH. Só dados fictícios. Os estudantes são menores. A única conta real é a do autor do TCC (18 anos). Não é ferramenta clínica: sem diagnóstico, ranking ou comparação entre alunos.

## 2. Pastas (confira antes de editar)
- Única pasta de trabalho: `C:\TW1-DEV\siesal-4`, ramo `siesal-4`. Docker Compose "siesal". Site em http://localhost:18080 (`WEB_PORTA=18080` no `.env`).
- Nunca editar a pasta da v3 (`Documents\GitHub\Sistema-de-Grenciamento-Escolar---Siesal`, ramo `main`). A v3 deve continuar intacta e pública.
- Nunca tocar no TI-REX, em `TIREX-DEV`, em `painelti`, n8n, Evolution, Chatwoot, GLPI, Apache, MariaDB ou N8N_ENCRYPTION_KEY. Nenhum container, rede, banco, volume, chave ou credencial compartilhado com o TI-REX.
- `Documents\GitHub\SIESAL4x` está vazia. Ignore.
- Se a pasta da sessão não for `siesal-4`, pare e avise o autor.

## 3. Como trabalhar
- Nada avança de gate sem aprovação explícita do autor. Silêncio ou "ok" vago não autoriza código, banco, instalação, deploy nem repositório.
- Lotes de 1 a 3 itens. Escopo congelado por lote: pedido novo vai para o próximo lote, salvo defeito ou segurança.
- Ciclo: solicitação, estado anterior, proposta, aprovação, execução, validação, entrega, merge, deploy. Merge e deploy exigem autorizações separadas.
- Mesmo procedimento e mesma estrutura em todo lote (pedido do autor: "manter a recursividade"). Isso inclui manter o mesmo padrão visual e a mesma responsividade.
- Numeração: lotes seguem L13 a L20. Variações usam letras: L13a, L13b, L13c etc. Um lote por vez; cada um precisa de aprovação própria.
- Ambiguidade que muda o resultado: uma pergunta fechada, com a opção recomendada primeiro. Nunca adivinhe.
- Discorde com motivo e alternativa em 1 ou 2 linhas. A decisão final é do autor.
- Prioridade: segurança e defeito, depois o que bloqueia a entrega, depois melhoria.
- Estados: Planejado, Prototipado, Implementado, Verificado, Aprovado para produção. Nunca declare "pronto" o que não foi testado. "Verificado" exige a checagem humana (leitor de tela, teclado, contraste, NAPNE) e nenhuma falha aberta.
- Não faça commit, push, merge nem deploy. O autor faz o commit com a identidade dele. Nunca defina autor de commit.
- Todo entregável termina com Feito, Falta e Sugestões.

## 4. Padrão de código
- Código enxuto, TypeScript estrito, nomes de domínio em português, um comentário curto em PT-BR por bloco.
- Deny by default. Matriz de permissões versionada (`shared/src/permissoes.json`) que gera testes. Auditoria append-only com hash. Nada se apaga de verdade (usar `desativado_em`).
- Banco: PostgreSQL 18 com RLS e `withTenant`. Migração só pelo job `migrate`, com backup antes.
- Sem segredo, dado real ou dump no git. `.env` e `backups/` ficam fora do git. Nunca use `git add .`; liste os arquivos.
- Versões exatas, sem `^` nem `~`.
- Antes de entregar: lint, typecheck e testes passando; telas novas passam no axe.
- Responsividade: toda tela nova ou alterada funciona em celular, tablet e computador, nos navegadores comuns, mantendo o padrão visual existente. Alvos de toque de pelo menos 44 px. Sem rolagem horizontal. Conferir em 360, 768 e 1280 px de largura.

## 5. Tempo concreto (regra de produto)
Há alunos que não têm noção de tempo, de minutos nem de horas. Em toda tela nova ou alterada:
1. Nunca mostrar tempo só como número. Mostrar a palavra ("hoje", "amanhã"), a data (dia/mês) e uma forma visual (barra, blocos ou círculo).
2. Duração em blocos (curto, médio, longo), com os minutos pequenos ao lado. O aluno escolhe o bloco; não digita minutos.
3. Parte do dia com nome e ícone (manhã, tarde, noite). Hora exata só como detalhe.
4. Modo foco com forma que diminui. Sem contagem em números por padrão. Som desligado por padrão. "Parar por agora" sem punição.
5. Tudo opcional: o aluno liga, desliga ou oculta.
6. Texto literal, sem pressão, sem ironia, sem duplo sentido, sem metáfora.

## 6. Comunicação com o autor (acessibilidade cognitiva)
- Resultado na primeira linha; detalhe só quando pedido.
- Uma pergunta por mensagem, fechada, com a opção recomendada primeiro.
- Passos numerados, curtos, com critério de "terminou". No máximo 5 por vez.
- Comandos de terminal sempre em bloco de código próprio, prontos para copiar e colar, um comando por bloco. Nunca no meio do texto.
- Datas explícitas (dia/mês). Separar fato de estimativa.
- Sempre dizer o que foi feito, o próximo passo e o que depende do autor.
- Sem surpresa: avisar antes de mudar plano, escopo ou ordem, com motivo em 1 linha.
- No máximo 1 tema novo por mensagem. Se as pendências acumularem, propor cortar escopo.

## 7. Comandos do projeto (um por bloco ao mostrar ao autor)
- Estado: `docker compose ps`
- Backup (bash, no terminal WSL): `bash scripts/backup.sh`
- Migrar (bash, com backup antes): `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`
- Testes no Docker: `docker compose --profile teste run --rm --build teste`
- Subir ou refazer o site: `docker compose up -d --build`
- Lint, tipos e testes locais (precisa de pnpm): `pnpm verificar`
- `VAR=valor comando` é sintaxe de bash. No PowerShell não funciona; use o terminal WSL.

## 8. Falhas e retorno
- Falha durante o trabalho é corrigida e registrada em `docs/REGISTRO-DE-FALHAS.md`: data, o que falhou, causa, correção e como voltar atrás.
- Não encha o chat com cada tropeço corrigido. Vira 1 linha na mensagem só se afetar segurança, dados, escopo aprovado, prazo, ou se não foi resolvida.
- Nunca esconda ou apague um registro. Se um passo falhar 2 vezes, pare e registre.
- Retorno de migração ou de dados só com backup feito e o passo descrito antes de executar.

## 9. Conformidade
CIDA + Rastreabilidade, LGPD, ECA Digital (Lei 15.211/2025), WCAG 2.2 AA e eMAG. Diga "projetado para atender". Só use "em conformidade" depois de parecer jurídico. Você não é advogado.

## 10. Onde estão os documentos
- Neste repositório: `README.md` e `docs/` (`PROCEDIMENTO-VERIFICACAO-DE-AMBIENTE.md`, `REGISTRO-DE-FALHAS.md`, `VERIFICACAO-NUCLEO.md`).
- O Projeto "TW1-SaaS-SIESAL" no claude.ai guarda a Visão, os ADRs, a matriz de permissões, o registro de aprovações e o roteiro. O Code não lê esse Projeto. O autor cola a mensagem de abertura com o estado atual. Nunca invente o que não está aqui ou na mensagem.
- Precedência: 1) registro de aprovações; 2) este arquivo e a mensagem de abertura; 3) README e docs; 4) propostas novas.
