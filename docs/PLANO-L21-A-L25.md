# PLANO — L21 a L25 (painel do Master, 2 fatores, modo demonstração) — 12/11/2026

Estado: **Planejado**. Nenhum código feito. Cada lote precisa da aprovação própria (CLAUDE.md, seção 3).
Prazo da Parte 1: 10/12/2026. Pontos de controle: 20/11 e 01/12.

## Pedidos do autor (12/11/2026, chat)
1. Calendário: o **aluno escolhe** entre grade e lista; as duas opções ficam.
2. Código temporário no e-mail: é **adicional** (2º fator), não substitui a senha.
3. Autenticação por papel: no início, **Master e Admin** = e-mail + autenticador + senha; **demais** = só senha. O Master pode habilitar 2 fatores (código no e-mail ou autenticador) para outros.
4. **Modo demonstração:** o Master liga por uma "chave" no painel, para uma instituição ou um aluno isolado. Nesse modo nada é gravado de verdade, o responsável de menor não precisa validar o cadastro, e os dados são apagados depois da demonstração.
5. **Árvore do Master:** visão em árvore de toda a instituição (admins, professores, pedagogos, alunos, responsáveis). Admin cria e desativa só os da própria instituição, sem acesso a outra. Professores e pedagogos podem fazer parte de várias instituições e de alunos isolados.

## Lotes (1 a 3 itens cada)

### Prioridade 1 — segurança e defeito
- **L21a:** (1) cabeçalho HSTS, pronto mas só ligado com HTTPS; (2) teste automático de injeção de SQL nas rotas que recebem texto; (3) causa raiz do F-056 (resposta antes do commit), removendo o contorno dos testes.
- **L21b:** calendário com grade e lista, preferência do aluno (guardada na personalização dele). Padrão visual e responsividade atuais.

### Prioridade 2 — bloqueia a entrega da Parte 1
- **L22a:** vínculo de professor e pedagogo a várias instituições e a alunos isolados, **e cadastro próprio** para quem não vem de instituição (modelo de dados, RLS, matriz de permissões). Base da árvore. Migração com backup antes.
- **L22b:** árvore do Master (somente leitura) + menu com as áreas (Administradores, Professores, Pedagógicos/NAPNE, Alunos, Responsáveis, Usuários sem vínculo) + indicador de ambiente teste/produção.
- **L22c:** Admin cria e desativa só os usuários da própria instituição (teste de que não alcança outra); revogar convite; manual automático por tipo de destinatário.
- **L23a:** política de autenticação por papel, configurada pelo Master, e 2º fator por código de e-mail (uso único, validade curta, limite de tentativas, auditoria).
- **L23b:** modo demonstração (chave do Master, por instituição ou aluno isolado; sem gravar de verdade; sem validação de responsável; limpeza dos dados ao final). Maior risco do plano: precisa de proposta própria antes de código.
- **L24:** verificação humana (contraste, leitor de tela, teclado) nos perfis Responsável, Professor, Pedagógico e Admin, em 360, 768 e 1280 px.

### Prioridade 3 — melhoria
- **L25:** revisão do RIPD, da Política e do Mapa de Riscos (inclui dificuldade vista pelo Pedagógico, A-064 a A-066, e o modo demonstração). Sem "em conformidade" antes de parecer jurídico.

## Decisões do autor (12/11/2026, chat) — registradas como A-069
- **D1:** o projeto inteiro terá um botão de **sair da demonstração** (bancos simulados, dados fictícios). Depois que sair, **não volta mais** a ser demonstração. Nenhuma conta criada em demonstração conta como real, porque o banco da demonstração é apagado.
- **D2:** a demonstração de aluno e a de instituição ficam em **banco temporário**, que pode ser apagado.
- **D3:** professor convidado a um aluno vê só o que é daquele vínculo; em instituição, vê só o que é daquela instituição. Professor e pedagogo de aluno isolado **não são obrigados** a ter vínculo com instituição.
- **D4:** a ordem dos lotes fica a critério do Code: **L21a, L21b, L22a, L22b, L22c, L23a, L23b, L24, L25** (segurança e defeito primeiro; a árvore depende do vínculo múltiplo; a demonstração por último porque mexe em banco e precisa de proposta própria).
- **Para a proposta do L23b (a confirmar lá):** a chave por instituição ou aluno isolado continua existindo, ou fica só o botão global do projeto?
- **D5 (A-070):** professor e pedagogo sem instituição precisam de **cadastro próprio**; quem vem de instituição já tem. Como esse cadastro nasce (convite do aluno/responsável, dados mínimos, termo) será definido na proposta do L22a.
