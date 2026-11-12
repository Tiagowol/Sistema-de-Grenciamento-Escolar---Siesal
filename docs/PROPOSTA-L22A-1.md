# PROPOSTA L22a-1 — Pessoa, participação em vários espaços e conta do Responsável — 12/11/2026

Estado: **Planejado (proposta escrita). Nenhum código, migração ou deploy feito.** Fontes: Adendo 1 (seções 2 e 3), Adendo 3, Adendo 4, A-070, A-071, A-073.

## 1. Estado anterior (conferido no código)
- `usuario` pertence a **uma** instituição e tem **um** perfil (`PRIMARY KEY (instituicao_id, id)`, e-mail único por instituição). Credencial, sessão e TOTP também ficam por instituição.
- O aluno isolado é uma instituição do tipo "individual" (migração 0020). Não há Admin nesse espaço.
- No aluno menor, o aluno se cadastra e o Responsável só clica num link (migração 0022: `pedido_responsavel`, situação `aguardando_responsavel`). O Responsável **não tem conta**.
- Professor e pedagogo só existem dentro de uma instituição.

## 2. Proposta
**Ideia:** o isolamento por espaço (instituição ou aluno isolado) e a RLS **não mudam**. Acrescenta-se uma camada acima: a **pessoa** (uma conta de login) que **participa** de um ou mais espaços.

1. **`pessoa`** (nova): identidade de login (nome, e-mail confirmado, senha, TOTP). Fora dos dados escolares; só identificadores.
2. **`participacao`** (nova): pessoa, espaço, papel, situação, `usuario_id` do espaço, datas. Uma pessoa pode ter várias (professor em 2 instituições, pedagogo de 1 aluno isolado).
3. **`usuario` continua existindo por espaço** (ganha `pessoa_id`). Todas as tabelas escolares seguem apontando para `usuario`, então nenhuma consulta cruza espaços.
4. **Login:** e-mail e senha da pessoa, depois **escolha do espaço** (tela "Em qual espaço você quer entrar?", com nome do espaço e papel). A sessão continua sendo de **um** espaço. Trocar de espaço = nova escolha, sem digitar a senha de novo.
5. **Cadastro próprio** de professor e pedagogo sem instituição (A-070): a pessoa se cadastra (dados mínimos, e-mail confirmado, termo de aceite com versão, data e hora) e fica "sem vínculo" até aceitar um convite. Quem não tem vínculo não vê nenhum dado escolar.
6. **Responsável com conta** (Adendo 1, seção 3): o Responsável é uma pessoa. No aluno isolado menor, **o adulto cria a conta primeiro** e, dentro dela, o perfil do aluno. Dois tipos: **legal** (aluno menor) e **indicado** (aluno maior; o aluno pode retirar). **Decisão do autor (A-073): o Responsável indicado vê o mesmo que o Responsável do aluno menor.**
7. **Migração dos dados existentes:** 1 `pessoa` por `usuario` existente, **sem juntar automaticamente** pessoas com o mesmo e-mail em instituições diferentes (juntar sem confirmar o e-mail seria unir identidades sem prova). Juntar só por pedido da própria pessoa, com confirmação por e-mail. Lição da F-054: a função de migração roda com contexto por instituição e há **teste em banco com dados** que confere contagens antes e depois.

## 3. Perguntas fechadas (precisam da sua decisão; recomendação primeiro)
- **N2. Quem decide pelo menor no espaço individual (não há Admin)?** Recomendo: **o Responsável legal** decide (trocar e-mail, encerrar conta, aprovar vínculos); o **pedido de suporte vai ao Master**, que atende sem ver dado escolar. Alternativa: só o Master decide.
- **N4. Quem convida o professor ou pedagogo de um aluno isolado?** Recomendo: **o aluno maior ou o Responsável legal** (o pedido sempre nasce do lado do aluno; aluno menor só vale depois da aprovação do Responsável). Este lote cria só a **base** (pessoa e participação); o convite em si e a tela "Quem pode ver meus dados" são o L22a-2.
- **N5. O aluno isolado entra numa instituição. E os dados?** Recomendo: **ele fica com os dois espaços**, separados; os dados do espaço individual **não migram** para a instituição, e a instituição só vê o que ele fizer nela. Alternativa: migrar com consentimento (muito mais risco; não recomendo na Parte 1).

## 4. O que muda (arquivos e regras)
- **Migração 0025** (job `migrate`, **backup antes**, retorno em `docs/RETORNO-0025.md`): `pessoa`, `participacao`, coluna `usuario.pessoa_id`, funções `SECURITY DEFINER` com `search_path` fixo (mesmo padrão da 0022), RLS forçada nas tabelas novas, sem apagar nada.
- **API:** login por pessoa e lista de espaços; escolha de espaço; cadastro próprio; criação de conta do Responsável. Rotas escolares continuam por espaço.
- **Matriz de permissões v19** (`shared/src/permissoes.json`, gera testes): recursos `pessoa`, `participacao`, `conta_responsavel`; deny by default.
- **Tela:** escolha de espaço; cadastro próprio; cadastro do Responsável. Padrão visual atual, 360, 768 e 1280 px, alvos de 44 px, texto literal, sem pressão; axe nas telas novas.
- **Auditoria:** entrada de pessoa, escolha de espaço, aceite de termo e criação de participação, sem dados sensíveis.
- **Termos de aceite:** usar a minuta v0.1 (`docs/TERMOS-DE-ACEITE-MINUTA-v0.1-2026-11-12.md`), pendente de parecer jurídico.

## 5. Testes (obrigatórios antes de "Implementado")
1. Isolamento: pessoa em 2 espaços não lê dados de um estando no outro (RLS).
2. Migração em banco com dados: contagens iguais antes e depois; ninguém perde acesso; nenhum e-mail unido sem confirmação.
3. Login de pessoa com 0, 1 e vários espaços; sessão presa a **um** espaço.
4. Responsável legal e indicado: mesmo que o do menor; o aluno retira o indicado; Responsável sem aluno ativo não vê nada.
5. Sem vínculo = nenhum dado escolar.
6. Matriz: deny by default; teste gerado.
7. Injeção de SQL (a varredura do L21a cobre as rotas novas) e F-056 (resposta só depois do COMMIT).
8. Lint, tipos e todos os testes; axe nas telas novas.

## 6. Riscos
- **Alto:** muda a base de quem é quem; se atrasar, atrasam L22a-2, L26a, L22b, L22c e L27e. Por isso: 1 lote por dia, sem outro lote no mesmo dia.
- **Dados de menores:** a conta do Responsável e o aceite precisam de parecer jurídico (a minuta é rascunho).
- **Login:** mudar o login mexe em senha e TOTP; manter os dois caminhos (antigo e novo) até a verificação, para ninguém ficar sem entrar. Retorno por backup.

## 7. Como voltar atrás
Restaurar o backup feito antes da 0025 (caminho seguro) ou o SQL do `RETORNO-0025.md` (remove `pessoa`, `participacao` e a coluna `pessoa_id`; só vale se nenhuma conta nova foi criada). Voltar o código junto (`git revert`).

## 8. Feito, Falta, Sugestões
- **Feito:** proposta escrita; decisão do Responsável indicado registrada (A-073).
- **Falta:** sua decisão em N2, N4 e N5 (ou "ok proposta" para aceitar as recomendações); depois o código, o teste, a 0025 e a aplicação, cada um com sua autorização.
- **Sugestões:** executar o L22a-1 num dia sem outro lote; fazer a 1ª checagem humana até 20/11 em paralelo.
