# PROPOSTA CURTA — LOTE L20a (Personalizar e Acessibilidade) — SIESAL 4.0

Data: 11/11/2026. Estado: **Planejado. NÃO aprovado.** Nenhum ramo, código, migração, commit ou deploy foi feito.
Base: `siesal-4` em `c395289` (já enviado ao origin). Complementa `PLANO-L20A-A-L20D.md` e os adendos 1 e 2.
Ramo previsto: `lote-20a-personalizar`, a partir de `siesal-4`. Migração prevista: **0018**.

---

## 1. Resultado em 3 linhas
1. Os 6 achados C1 a C6 foram conferidos no navegador em 11/11/2026 (conta de aluno, tema escuro). **Os 6 se confirmaram.**
2. O lote tem 3 itens e nenhuma decisão pendente do proprietário.
3. É defeito (prioridade 1), por isso vai primeiro.

## 2. Conferência dos achados (fato, medido em http://localhost:18080)

| # | Achado | Resultado | O que foi medido |
| --- | --- | --- | --- |
| C1 | A cor de destaque troca só `--primary` | **Confirmado** | Trocando Verde, Roxo e Rosa, `--primary` mudou (#77ddd0, #cdb3ff, #f5a9cf). `--primary-soft` ficou em #253c5c nas 3. Só 6 de 31 fundos mudaram de cor; 25 ficaram fixos. |
| C2 | Escuro e alto contraste juntos dão cor errada | **Confirmado** | Com Tema escuro + Alto contraste na tela Acessibilidade: fundo preto (0,0,0) e `--primary` = #7e1450 (magenta escuro, calculado para fundo branco). Contraste baixo sobre preto. |
| C3 | Modo simples não esconde nada | **Confirmado** | A classe `simple` entra no corpo da página, mas 0 elementos usam `hide-on-simple` e a quantidade de elementos visíveis ficou igual (199 e 199). |
| C4 | Texto errado na tela Acessibilidade | **Confirmado** | A tela diz "Os outros ajustes ficam neste aparelho". Para o aluno, Personalizar diz "ficam salvas na sua conta". As duas frases se contradizem. |
| C5 | As 2 telas repetem controles com listas diferentes | **Confirmado** | Só em Acessibilidade: Leitura facilitada, Modo simples, Linguagem curta e "Escolha o que fazer agora". Só em Personalizar: apelido, cor, tela inicial, tipos de atividade. |
| C6 | Cores escritas direto no CSS | **Confirmado** | 179 cores em hexadecimal no CSS servido (o plano dizia 161 só em dois arquivos; a medida do servido é maior). |

Limites desta conferência: **não** testei "continua depois de sair e entrar" nem os perfis Responsável, Professor, Pedagógico, Admin e Master. Isso entra na tabela de teste do lote (item 2). Alto contraste claro × escuro no banco continua como leitura de código.
Efeito no ambiente: troquei a cor para Verde, Roxo e Rosa e voltei para "Cor do tema". Se a cor da conta de teste era outra antes, é só escolher de novo.

---

## 3. Itens do lote

### Item 1 — Cor e tema
1. A cor de destaque passa a mudar também o fundo suave, o menu, o painel de boas-vindas e a marca. Cada cor da paleta ganha um par: cor forte e cor suave, por tema.
2. Alto contraste claro e alto contraste escuro viram **temas distintos**, iguais nas 2 telas e no banco. Tema passa a ter 4 valores: claro, escuro, alto contraste claro, alto contraste escuro. Ligar "Alto contraste" mantém o fundo escolhido (claro ou escuro).
3. As cores fixas do CSS viram variáveis do tema. Cores que são sinal de estado (erro, sucesso) ficam fixas e documentadas.
4. Toda combinação cor × tema tem contraste mínimo de 4,5:1 (texto) e 3:1 (bordas e ícones). Combinação sem contraste não aparece como escolha, como já ocorre hoje. A API também valida.

### Item 2 — Conferência de Personalizar e Acessibilidade
1. **Tabela de teste** em `docs/VERIFICACAO-L20A.md`: cada controle × 4 temas × "continua depois de sair e entrar" × aluno e os outros 4 perfis. Cada linha com resultado real, sem marcar o que não foi testado.
2. **Modo simples (C3):** passa a esconder de fato. Proposta de lista, para o autor ajustar na entrega: cartões de apoio extras no Meu dia, textos de ajuda longos e filtros avançados. Não esconde nada que seja ação principal.
3. **Texto da tela Acessibilidade (C4):** a frase passa a ser verdadeira para os 5 perfis.
4. **Divisão das 2 telas (C5):** Personalizar fica com aparência (tema, cor, letra, apelido, tela inicial, tipos). Acessibilidade fica com o que facilita o uso (contraste, movimento, leitura facilitada, modo simples, tempo visual, linguagem curta, escolha agora, VLibras, botões do topo). Cada controle fica em **um só lugar**; o outro lugar ganha um link de uma linha. Se algum controle já existe nos dois, a lista final vai na tabela de teste.
5. **Preferências na conta para os 5 perfis:** hoje, para os 4 perfis que não são aluno, parte fica só no aparelho. Passam a ser salvas na conta (tabela `preferencia_usuario`). O aparelho vale só como reserva se o banco falhar.

### Item 3 — Tempo das atividades personalizável
1. Em Personalizar, 3 linhas: Curto, Médio, Longo, cada uma com botões **mais** e **menos** de 5 em 5 minutos. O aluno **não digita minutos** (regra de tempo concreto). Padrão: 10, 25 e 45.
2. Limites: de 5 a 120 minutos; sempre Curto < Médio < Longo (os botões não deixam cruzar, com mensagem curta). Botão "Voltar ao padrão dos blocos".
3. Cada bloco aparece com forma (blocos preenchidos) e palavra, e os minutos pequenos ao lado.
4. Os blocos próprios valem em Atividades, Agenda, Calendário e Foco. Plano e sessão já salvos **mantêm** os minutos que tinham.
5. A opção "Outro tempo" não existe (Adendo 1, seção 8).

---

## 4. Banco e permissões
- **Migração 0018** (só pelo job `migrate`, com backup antes): `tema` aceita 4 valores (dados atuais convertidos: `escuro`→escuro; `contraste`→alto contraste claro; os dois ligados→alto contraste escuro) e 3 colunas de minutos em `preferencia_usuario`, com `CHECK` de limites e de ordem.
- **Retorno:** `docs/RETORNO-0018.md`, escrito antes de aplicar, com backup e passo de volta.
- **Matriz de permissões:** sem recurso novo; a regra "só o dono lê e altera a própria preferência" vale para os 5 perfis e gera teste. Versão da matriz: **v12 se mantém**, salvo se o item 2 exigir recurso novo (aviso antes).
- Aviso de 1 linha antes de aplicar a migração no banco do site.

## 5. CIDA + Rastreabilidade
| Confidencialidade | Integridade | Disponibilidade | Autenticidade | Rastreabilidade |
| --- | --- | --- | --- | --- |
| Preferência é do usuário, ninguém mais lê | Contraste e minutos validados na API e no banco | Se o banco falhar, vale o aparelho | Só o dono altera | Auditoria de mudança de preferência (já existe) |

## 6. Terminou quando
1. Os controles de Personalizar e Acessibilidade passam na tabela de teste nos 4 temas.
2. A cor escolhida muda menu, botões, fundos suaves, painel de boas-vindas e marca, sempre com 4,5:1.
3. Escuro + alto contraste e claro + alto contraste ficam distintos, iguais nas 2 telas e depois de sair e entrar.
4. O Modo simples esconde itens de fato.
5. Blocos próprios valem em Atividades, Agenda, Calendário e Foco; nenhum minuto é digitado.
6. Lint, tipos e testes passam; axe sem violações; medido em 360, 768 e 1280 px, sem rolagem horizontal e com alvos de 44 px.
7. Estado ao entregar: **Implementado**. Não será "Verificado" sem a checagem humana (leitor de tela, teclado, contraste, NAPNE).

## 7. Fora do lote
Disciplinas (20b), aluno sem instituição (20c), dificuldade, cards e grade do dia (20d), mudança de aparência por identidade da escola (já existe no L19), qualquer chamada ao SUAP.

## 8. Riscos
| Risco | Resposta |
| --- | --- |
| Trocar 179 cores no CSS pode mudar telas sem querer | Fazer por grupos, com captura de tela antes e depois em 360, 768 e 1280 px |
| Conversão do tema antigo para 4 valores | Migração testada em cópia do banco; retorno escrito |
| Modo simples esconder algo necessário | Lista aprovada na entrega; nada de ação principal escondido |

## 9. Pedido de aprovação
Para começar, o autor diz: **"aprovo o L20a"**. Sem isso: nenhum ramo, nenhum código.

## Feito, Falta, Sugestões
**Feito:** conferência de C1 a C6 no navegador (os 6 confirmados); proposta dos 3 itens; plano de banco, retorno e testes.
**Falta:** "aprovo o L20a" e "aprovo" da divisão dos lotes; conferir os outros 4 perfis e a persistência na tabela de teste (dentro do lote); ajuste da lista do Modo simples na entrega.
**Sugestões:** levar a lista do Modo simples (item 2.2) ao NAPNE em 12/11/2026 antes de implementar.
