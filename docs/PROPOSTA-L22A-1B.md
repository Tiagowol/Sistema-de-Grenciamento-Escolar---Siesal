# PROPOSTA L22a-1b — Login por pessoa, cadastro próprio e escolha de espaço — 12/11/2026

Estado: **Planejado (proposta curta).** Base: `docs/PROPOSTA-L22A-1.md` (aprovada, A-074 e A-075). Pedido do autor: começar agora.

## 1. Achado que muda o desenho
Uma pessoa **sem vínculo** (professor ou pedagogo que se cadastrou sozinho e ainda não foi convidado) **não tem linha em `usuario`**, e `usuario`, `credencial` e `sessao` exigem uma instituição. Por isso ela precisa de **senha e sessão próprias, acima dos espaços**. Sem isso o "cadastro próprio" (A-070) não existe. O login antigo (por instituição) **continua igual** para todos os que já existem.

## 2. Divisão (variações do lote, 1 a 3 itens cada)
- **L22a-1b (este):** (1) cadastro próprio de professor e pedagogo, com e-mail confirmado e aceite do termo; (2) login da pessoa (e-mail e senha, só senha, como decidido para os demais perfis); (3) tela "Em qual espaço você quer entrar?" (lista vazia = "Você ainda não participa de nenhum espaço. Aguarde um convite.").
- **L22a-1c (depois):** conta do **Responsável** (legal e indicado), criada antes do aluno no espaço individual menor.
- **L22a-2 (já previsto):** convite do aluno, aprovação do Responsável, tela "Quem pode ver meus dados". É o que liga uma pessoa a um espaço.

## 3. Desenho
1. **Banco (migração 0026):** `credencial_pessoa` (senha, falhas seguidas, bloqueio: mesmas regras de hoje, 5 falhas e 15 minutos), `sessao_pessoa` (hash do token, validade curta), `pedido_email_pessoa` (link de uso único, só o hash, vale 24 h, para confirmar o e-mail). Todas com RLS forçada e **só o dono lê** (como `pessoa`). Funções `SECURITY DEFINER` com `search_path` fixo: criar cadastro, confirmar e-mail, ler credencial, registrar falha, abrir e encerrar sessão de pessoa, listar espaços da pessoa.
2. **Só pessoa com e-mail confirmado entra** (e-mail confirmado é único; a pessoa criada de usuário antigo continua sem login por pessoa: ela entra pelo login antigo).
3. **Cadastro próprio:** nome, e-mail, senha (mesma regra de senha de hoje), papel desejado (professor ou pedagógico) e aceite do termo; o papel **não dá acesso a nada** até haver convite aceito. Confirmação por e-mail (caixa de teste do Docker; envio real é Parte 2). Resposta igual para e-mail novo e já existente (não revela quem tem conta).
4. **Login da pessoa:** `POST /auth/pessoa/login`; limite de tentativas por IP e bloqueio por conta (reusa `LimitadorJanela`); cookie próprio `siesal_pessoa`, separado do cookie de espaço.
5. **Espaços:** `GET /auth/pessoa/espacos` lista (nome do espaço, papel); `POST /auth/pessoa/entrar {instituicao_id}` abre a sessão normal **de um espaço** (a mesma de hoje, sem digitar a senha de novo) e a pessoa passa a ver só o que aquele papel vê. A lista vem de `usuario.pessoa_id` (só participações ativas de espaço ativo).
6. **Matriz v19** (`shared/src/permissoes.json`): recursos `pessoa_conta` (própria) e `pessoa_espacos`; deny by default; teste gerado.
7. **Tela:** "Cadastro de professor e pedagogo", "Entrar como pessoa" (no login, link discreto) e "Escolha o espaço"; padrão visual atual; 360, 768 e 1280 px; alvos de 44 px; texto literal; axe.

## 4. Fora deste lote
Conta do Responsável (1c); convite e aprovação (L22a-2); 2º fator por e-mail ou autenticador (L23a); juntar pessoas de e-mails iguais (só com pedido da pessoa).

## 5. Riscos e retorno
- **Login novo ao lado do antigo:** os dois convivem; nenhum usuário atual muda. Falha no novo não derruba o antigo.
- **Dados de pessoas fora de instituição:** nome e e-mail ficam no banco; o termo e o RIPD (L25) precisam cobrir. Só dados fictícios na Parte 1.
- **Retorno:** backup antes da 0026; SQL em `docs/RETORNO-0026.md` (remove as 3 tabelas e as funções; só vale se ninguém se cadastrou).

## 6. Feito, Falta, Sugestões
- **Feito:** proposta curta escrita.
- **Falta:** migração 0026, API, telas, testes, aplicação (cada um com autorização de commit e de aplicar).
- **Sugestões:** ver o cadastro e o login funcionando na caixa de teste antes de aplicar no site.
