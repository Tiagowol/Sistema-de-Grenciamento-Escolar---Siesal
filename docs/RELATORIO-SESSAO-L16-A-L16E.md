# Relatório da sessão: L16 a L16e (08/11/2026) e passagem para a nova tela

Ramo: `lote-16-avisos` (criado a partir de `lote-15-notas`). **Nada foi commitado.** Sem Master em nenhum ponto.
Projetado para atender LGPD, ECA Digital, WCAG 2.2 AA e eMAG. Sem parecer jurídico. Nada está "Verificado" (faltam as checagens humanas).

## 1. O que foi feito, por lote

### L16: avisos e mensagens (Pacote B)
- Dois sinos no topo: **Mensagens** (amarelo, balão, 5 perfis escolares) e **Prazos** (azul, calendário, só o aluno). Sem vermelho, nome para leitor de tela, alvo de 44 px, Esc fecha e devolve o foco.
- Caixa por perfil reaproveitando `pedido_revisao`; "Fechar juntos" (revisar uma nota fecha os outros pedidos abertos da mesma nota, na mesma transação, com auditoria); avisos curtos só de leitura (300 letras, sem link, sem anexo, sem resposta). Pedagógico publica para uma turma (desvio aprovado: não existe vínculo Pedagógico e turma); Admin para a instituição.
- Matriz de permissões v5; migração `0009_avisos.sql` (tabelas `aviso_escolar` e `aviso_visto`, RLS forçada), aplicada com backup; retorno em `docs/RETORNO-0009.md`.
- Regra A-027: aluno, responsável e Pedagógico veem só estado, nota atual e data; motivo da revisão e versões antigas só professor e Admin. **F-036 (segurança)**: o commit d428548 (L15) vazava o motivo; corrigido no L16.

### Acesso público temporário e auditoria externa
- Túnel Cloudflare (`siesal-tunel`) com cookie seguro `__Host-`, contas fictícias (aluno, professor, responsável, pedagógico), encerramento agendado. 104 verificações pela URL HTTPS.
- Documentado em `docs/ACESSO-PUBLICO-TEMPORARIO.md` (frases "ativar/desativar acesso público temporário"), `docs/AUDITORIA-EXTERNA-L16.md` e `docs/PLANO-DE-TESTES-AUDITORIA-L16.md`.
- Incidente registrado: uma senha provisória foi impressa na saída de um comando; foi trocada na hora.
- Contas de teste do autor criadas (`aluno@`, `professor@`, `responsavel@`, `pedagogo@teste.com`). **Masters não criados**: o login de Master não existe (vai para o L18).
- O relatório de auditoria (PDF de 08/11/2026) gerou o plano em `docs/PLANO-L16A-CORRECOES-DA-AUDITORIA.md`.

### L16a: AUD-01 a AUD-05 (feito)
AUD-01 cabeçalho cresce com fonte grande e nome longo; AUD-02 (F-038) e AUD-03 `Permissions-Policy` em todos os blocos do nginx (`web/seguranca.conf`) e `Cache-Control: no-store` em toda a API (exceto `/saude`); AUD-04 mensagem de autoria corrigida; AUD-05 README atualizado.

### L16b (feito)
Selo "Prazo passou" sem vermelho (Avisos, Atividades, Meu dia; era o F-040) e contador lateral azul; foco do tema claro de 2,91:1 para 5,6:1 (`#00718c`); explicação dos blocos agrupados antes de salvar o plano (`web/src/plano.ts`).

### L16c: Funnel e proxy (feito, com ajuste)
- Funnel: `tailscale funnel --bg 18081`, endereço fixo `https://ntb-w1lopes.tail378cb5.ts.net` (autor ligou e testou). **Atualizado em 09/11/2026:** o endereço agora é `https://siesal.tail378cb5.ts.net` (F-042, fechada).
- Container `proxy` (porta 18081): repassa ao site; fora da janela mostra "Sistema em construção. Entre em contato com o desenvolvedor." (503, sem dado e sem cookie).
- **Janela automática 06:00 a 23:59 em America/Sao_Paulo**; `MANUTENCAO_MODO` = `auto`, `ligada` ou `liberada`; comandos `bash scripts/manutencao.sh ligar|liberar|automatico|estado`. (A primeira versão tinha só um horário único; corrigido.)
- Doc: `docs/FUNNEL-E-MANUTENCAO.md`.

### L16d (feito)
Menu lateral recolhível no computador (botão no conteúdo, `aria-expanded`, lembrado no aparelho); busca no menu (sem acento, palavras equivalentes, respeita o perfil, acha configurações dentro de Acessibilidade); estados de carregamento distintos de vazio e erro (`Carregando`, `useCarregar.carregando`).

### L16e (feito)
Ajuda no menu e botão no topo; manual por perfil (`web/src/manual.ts`, versão 1.0, 08/11/2026) com passos curtos, exemplos fictícios, busca sem acento e sem credenciais.

## 2. Números
- Unitários: 591 passam (web, api, shared). Integração no Docker: 134 passam (última rodada antes do L16d; a API não mudou depois). Lint e tipos limpos.
- Medições no navegador (só perfil Aluno, tema claro): 360 e 1280 px sem rolagem horizontal, alvos de 44 px ou mais.

## 3. Registro de falhas (`docs/REGISTRO-DE-FALHAS.md`)
F-033 a F-041. Abertas ou com pendência: F-036 (corrigida no L16, mas o commit d428548 ainda tem o defeito).

## 4. Pendências do autor
1. **Commit** (o autor faz). Sugestão de partes: L16; L16c; L16a e L16b; L16d e L16e. **Não enviar o L15 sozinho ao GitHub** (F-036).
2. Checagens humanas: leitor de tela, teclado, zoom de 200%, contraste real, outros navegadores, NAPNE (revisar o manual).
3. Medir os demais perfis e os temas escuro e alto contraste (medi só o Aluno, tema claro); a tela "Prazo passou" não foi medida no navegador.
4. Texto da **A-029** (comandos manuais de manutenção): os nomes dos comandos acima são meus; arquivo `claude/lote-16a-e/PROPOSTA-LOTES-16A-A-16E.md` não está no repositório.
5. Conferir se o Funnel segue ligado: `& 'C:\Program Files\Tailscale\tailscale.exe' funnel status`. O túnel da Cloudflare desliga sozinho às 23:00 de 08/11 (confirmar com `docker ps`).
6. Docker Scout (CVEs das imagens), tela de Admin com TOTP, varredura de segredos no histórico do Git, carga pelo nginx, ensaio de restauração.

## 4. Próximos lotes (ordem da A-030)
- **L17: Apoio ao aluno** (inclui "Linguagem curta", com revisão do NAPNE).
- **L18: Fechamento, com login dos Masters** (tabela `operator_account` já existe com 2 vagas pendentes; falta login, painel e TOTP).
- Regras que continuam: um lote por vez, aprovação própria, proposta curta antes do código, sem commit/push/merge/deploy pelo Code.

## 5. Passagem para a nova tela (cole na abertura)
- Pasta única: `C:\TW1-DEV\siesal-4`, ramo `lote-16-avisos`. Leia `CLAUDE.md`, este relatório e `docs/PLANO-L16A-CORRECOES-DA-AUDITORIA.md`.
- Estado: L16, L16a, L16b, L16c, L16d e L16e implementados e testados; aguardando commit e checagem humana. Próximo: L17 (proposta curta primeiro).
- Comandos úteis (um por vez): `docker compose ps`; `docker compose up -d --build`; `docker compose --profile teste run --rm --build teste`; `pnpm verificar`; `bash scripts/manutencao.sh estado`.
- Frases com procedimento pronto: "ativar acesso público temporário" e "desativar acesso público temporário" (`docs/ACESSO-PUBLICO-TEMPORARIO.md`).
- Dados sensíveis: arquivos de credenciais ficam em `backups/` (fora do git). Nunca imprimir senha.
- Não tocar no TI-REX nem na v3.
