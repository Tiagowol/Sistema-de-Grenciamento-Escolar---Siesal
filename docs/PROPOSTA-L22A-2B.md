# PROPOSTA L22a-2b — Acompanhamento por código da instituição — 13/11/2026

Estado: **Planejado (proposta escrita). Nenhum código ou migração feito.** Base: `PROPOSTA-L22A-1C-E-L22A-2.md` (caminho B, Q3, Q4, Q5), A-080, A-081, A-084, A-085. Pedido do autor (13/11): "Sim, L22a-2b".
Depende do L22a-2 (migração 0028), que ainda não foi commitado nem aplicado: o commit do código do L22a-2 e a aplicação da 0028 vêm antes (cada um com autorização própria).

## Estado anterior (conferido)
- O pedido por e-mail (caminho A) existe: aluno ou representante legal convida uma **pessoa**; a pessoa lê por funções do banco, sem virar usuário do espaço do aluno.
- O caminho B não existe. O Pedagógico de uma instituição não tem como acompanhar um aluno de espaço individual, e a instituição não tem como encerrar ou renovar vínculos dela.
- Os usuários de instituição (Pedagógico e Admin) **não têm pessoa ligada** (não há fluxo para ligar). Por isso o desenho abaixo não depende de pessoa.

## Regra (Adendo 1): o pedido nasce do aluno
O aluno (ou o representante legal, se menor) digita o **código da instituição**. Ninguém procura aluno e o aluno não vê lista de profissionais.

## Itens (3)
1. **Código da instituição.** O Admin liga "aceitar pedidos de acompanhamento" e recebe um código (mostrado uma vez, guardado só como hash; pode gerar outro, o antigo deixa de valer; pode desligar). Código errado, desligado ou de instituição suspensa: mesma resposta, limite de tentativas por IP.
2. **Pedido do aluno e fila do Pedagógico.** O aluno digita o código e marca as 4 caixas (padrão: nada). O pedido cai na fila do Pedagógico da instituição, que vê **só o nome do aluno e as caixas pedidas** e aceita ou recusa. Aluno menor: o vínculo só vale depois que o representante legal aprova (igual ao 2a). Quem aceita **vira o acompanhante** e lê pela própria sessão de instituição, um aluno e um item por vez, só o liberado, com auditoria sem o valor.
3. **Encerrar e renovar pela instituição.** Admin e Pedagógico da instituição encerram um vínculo dela a qualquer momento, com justificativa obrigatória e registrada. Renovação **em lote** pela instituição (Q3). O aluno pode **prorrogar por 30 dias** um vínculo de instituição que venceu ou vai vencer. Avisos de 30, 15 e 1 dia aparecem para o aluno, o representante e o Pedagógico, em palavra, data e barra.

## Desenho (mesmo cuidado do 2a)
- **Migração 0029 (prevista):** `acompanhamento` ganha origem `codigo`, instituição e usuário acompanhantes (nulos no caminho A); tabela `codigo_acompanhamento` (instituição, hash, ativo; só o dono); funções `SECURITY DEFINER` para validar o código, criar o pedido, listar a fila (só nome e caixas), aceitar, recusar, ler um item, encerrar, renovar em lote e prorrogar. RLS e matriz atuais continuam; nenhuma consulta cruza espaços fora dessas funções. Matriz v20 (`acompanhamento_externo`: Pedagógico escopo "vinculo"; Admin administra só o código e os vínculos da instituição). Backup antes; `docs/RETORNO-0029.md` antes de aplicar.
- **O acompanhante da instituição não vira usuário no espaço do aluno** (mesmo motivo do A-084): lê por rotas próprias da instituição, que chamam funções do banco.
- Telas: Admin (código), Pedagógico (fila e "Alunos que acompanho"), aluno e representante ("Falar com uma instituição" e prorrogar). Padrão visual, 360/768/1280 px, alvos de 44 px, axe.

## Perguntas fechadas (recomendação primeiro)
- **Q6. Quem é o acompanhante quando a instituição aceita?** Recomendo: **o Pedagógico que clicou em aceitar** (acesso nominal, auditável). Alternativa: a instituição inteira (qualquer Pedagógico lê) — não recomendo, amplia o acesso a dado de menor.
- **Q7. Validade do vínculo de instituição.** Recomendo: **até o fim do calendário escolar da instituição**; se ela não tiver calendário, 12 meses.
- **Q8. Quem liga e gera o código?** Recomendo: **só o Admin**. Alternativa: Admin e Pedagógico.

## Testes
Código errado, desligado ou antigo dá a mesma resposta; pedido nunca nasce da instituição; menor sem aprovação não libera nada; Pedagógico de **outra** instituição não vê nem aceita; fila mostra só nome e caixas; item não marcado, vencido ou encerrado não lê; encerrar exige justificativa e corta na hora; lote só mexe nos vínculos da própria instituição; prorrogação de 30 dias só pelo aluno (ou representante, se menor); limite de 5; auditoria sem valores; injeção de SQL nas rotas novas; F-056; axe e 360/768/1280 px.

## Riscos
- **Alto:** dado de menor lido por profissional de outra instituição; depende de parecer jurídico (RIPD e Política no L25) antes de qualquer dado real. Só dados fictícios.
- **Ordem e ritmo:** é lote grande; o Adendo 4 recomenda 1 por dia. Já foram 2 hoje (1c e L22a-2). Recomendo executar em 14/11.
- **Retorno:** backup antes; SQL em `RETORNO-0029`; `git revert` do commit.

## Feito, Falta, Sugestões
- **Feito:** proposta escrita.
- **Falta:** "ok proposta" (com as respostas Q6 a Q8); antes dele, commit do código do L22a-2 e aplicação da 0028.
- **Sugestões:** aceitar as 3 recomendações; commitar e aplicar o L22a-2 hoje; executar o L22a-2b amanhã.
