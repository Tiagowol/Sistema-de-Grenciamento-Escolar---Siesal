# Plano: correções da auditoria de 08/11/2026 e encaixe das melhorias

Origem: `Relatorio-SIESAL-Auditoria-08-11-2026.pdf` (auditoria externa do L16, dados fictícios).
Estado: **proposta, sem código**. Nada avança sem o "sim" do autor (gate de aprovação).
Estimativas são minhas, não medidas. Lote = 1 a 3 itens (CLAUDE.md, seção 3).

## 1. O que o relatório disse (resumo)
Conclusão do próprio relatório: cobertura parcial, **não é aprovação para produção**. Sem quebra de autorização nem vazamento demonstrado.
Achados: AUD-01 a AUD-05 e OBS-01. Melhorias de produto: 6. Pendências de verificação: 9 (seção 5).

## 2. Lote de correção: L16a (3 itens)
Variação do L16, no ramo `lote-16-avisos` ou em ramo novo a partir dele (decisão do autor). Escopo congelado depois da aprovação.

| Item | Achados | O que fazer | Critério de pronto |
|---|---|---|---|
| 1. Cabeçalho com texto grande | AUD-01 | O cabeçalho cresce com a fonte; o nome longo quebra linha; sino de Mensagens, sino de Prazos e Sair continuam visíveis e com 44 px | Teste nos 5 perfis, nome longo, fonte 100% a 150%, temas claro/escuro/alto contraste, 360/768/1280 px; teste automatizado de não transbordar |
| 2. Cabeçalhos e cache | AUD-02 (F-038), AUD-03 | Repetir `Permissions-Policy` e demais cabeçalhos em `location /` do nginx; `Cache-Control: no-store` nas respostas escolares da API (caixa, notas, pedidos, avisos, tarefas) | Teste automático que lista cabeçalhos de `/` e das rotas autenticadas; conferir também pelo HTTPS do túnel |
| 3. Mensagem de autoria e README | AUD-04, AUD-05 | Corrigir "Outro professor lançou esta nota" quando a autora é a própria professora; atualizar `README.md` (estado atual, telas, como verificar) | Teste da tela com professora autora e com outro professor; README sem divergência com o L16 |

Estimativa: item 1 médio (maior risco visual), itens 2 e 3 pequenos. Total aproximado de 1 a 1,5 dia de trabalho.
Segurança: o item 2 é o único com ligação a segurança (defesa em profundidade); sem demonstração de vazamento.

## 3. L16b (pequeno, depois do L16a) — itens que o relatório repete de riscos já conhecidos
| Item | Origem | O que fazer |
|---|---|---|
| 1. Selo vermelho "Prazo passou" | risco do plano; regra "sem vermelho de alarme" | Trocar por forma e texto neutros, sem vermelho; contador lateral `#e4535e` também |
| 2. Foco global com contraste cerca de 2,9:1 | risco do plano; WCAG 2.2 AA | Anel de foco com pelo menos 3:1 em todos os temas |
| 3. Blocos agrupados (OBS-01) | OBS-01 + melhoria "Explicar blocos agrupados" | Antes de salvar, mostrar quantidade, duração total e distribuição; texto literal |

Motivo de ser lote à parte: mexe no padrão visual e no tempo concreto (CLAUDE.md, seção 5); o L16a mexe em estrutura.

## 3b. Numeração corrigida pela A-030 (08/11/2026)
Vale a proposta `claude/lote-16a-e/PROPOSTA-LOTES-16A-A-16E.md` (não está neste repositório; sigo a ordem e os critérios da mensagem da A-030 e do relatório de auditoria).
- O que eu chamei de "L16d" (Atrasada vira "Prazo passou") é o **item 1 do L16b**. F-040 foi registrada assim.
- Ordem dos lotes: L16a, L16b, L16c (feitos) → **L16d** (barra lateral recolhível, estados de carregamento, busca no menu) → **L16e** (ajuda no menu e manual por perfil) → só depois **L17 (Apoio ao aluno)** → **L18 (Fechamento, com login dos Masters)**.
- Nada de Master antes do L18.

## 4. Melhorias do relatório: onde encaixar
| Prioridade | Melhoria | Lote |
|---|---|---|
| Alta | Recolher / mostrar barra lateral | **L16d** |
| Média | Estados de carregamento claros | **L16d** |
| Alta | Busca no menu | **L16d** |
| Alta | Ajuda no menu + Manual do sistema por perfil | **L16e** |
| Média | Linguagem curta ("Vamos por partes", "Escolha o que fazer agora") | Fica para o L17 (Apoio ao aluno); exige revisão do NAPNE |
| Média | Explicar blocos agrupados | Feito no L16b (item 3) |

## 5. Pendências do relatório que não são código
Dependem de pessoa ou de ferramenta. Entram como **gate de verificação** antes de qualquer "Verificado":
1. Leitor de tela e NAPNE.
2. Contraste real e zoom de 200%.
3. Outros navegadores e dispositivos reais.
4. Docker Scout (CVEs das imagens): exige login do autor.
5. Varredura de conteúdo e histórico do Git por segredos.
6. Carga pelo nginx e pelo túnel; ensaio prolongado.
7. Recuperação operacional da aplicação na cópia do backup.
8. Tela de Admin com TOTP (nenhuma conta pública de Admin existe).
9. Inventário de rede e rastreadores.

## 6. Decisões e avisos para o autor
- **Masters**: o login de Master **não existe no sistema** (README: "fica para o Lote 6"; a tabela `operator_account` tem só 2 vagas, hoje `w1lopes` e `tw1lopes`, pendentes e sem senha, e o nome de usuário aceita só `a-z 0-9 _`, não e-mail). Criar Master com e-mail e senha exige código e migração, o que está fora do L16a. Por isso **não criei** os Masters nem coloquei o e-mail de terceiro (`tiago.wofl`) no banco. Sugestão: lote próprio de login de Master, quando o roteiro permitir.
- **Admin e TOTP**: o Admin só entra com TOTP (aplicativo autenticador). Sem isso, não há conta Admin de teste.
- **L15 (commit d428548)** ainda tem o vazamento do motivo da revisão (F-036). Não enviar o L15 sozinho ao GitHub; só junto com o L16 ou depois.
- **`/.env`, `/metrics`, `/admin` devolvem o HTML inicial** (comportamento normal de página única, sem arquivo exposto). Se quiser, o L16a pode devolver 404 nesses caminhos; não incluí para não passar de 3 itens.
- Conformidade: o sistema é **projetado para atender** LGPD, ECA Digital, WCAG 2.2 AA e eMAG. O relatório também não declara conformidade.

## 7. Como será conduzido (quando aprovado)
1. Estado anterior e proposta curta (já é este documento).
2. Código e testes primeiro; migração não é necessária neste lote.
3. Lint, typecheck, testes e axe passando; medição em 360, 768 e 1280 px.
4. Entrega com Feito, Falta e Sugestões. Sem commit, push, merge nem deploy meus.
