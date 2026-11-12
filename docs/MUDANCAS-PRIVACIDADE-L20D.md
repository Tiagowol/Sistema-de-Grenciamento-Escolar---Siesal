# Mudanças de privacidade exigidas pelo 20d

Para aplicar no Projeto "TW1-SaaS-SIESAL" (RIPD, Política de Privacidade, Mapa de Riscos). O Code não lê nem altera esses documentos. Obrigatório **antes de qualquer dado real**, não antes do código de teste. Redação em "projetado para atender"; só vale "em conformidade" depois de parecer jurídico.

## A. RIPD
1. **Dado novo:** dificuldade percebida de 0 a 10, por disciplina e por tarefa. Dado do aluno menor de idade, possivelmente ligado à sua condição de aprendizagem (tratar como sensível).
2. **Finalidade (decisão do autor em 12/11/2026):** pedido do NAPNE, para o Apoio Pedagógico acompanhar o aluno, saber onde ele tem dificuldade e ajudá-lo. Não é avaliação, não é diagnóstico, não é ferramenta clínica.
3. **Quem vê:** o próprio aluno e o Pedagógico/NAPNE da instituição, **sem o aluno precisar pedir** (D5, opção 2). Não veem: Professor, Admin, Responsável, outros alunos, Master.
4. **Base legal:** a confirmar no parecer jurídico (LGPD art. 14, ECA Digital, política pública de apoio à inclusão). Avaliar se a nota exige consentimento do responsável.
5. **Minimização:** campo opcional; leitura por um aluno por vez; sem média, ranking nem comparação; sem exportação em lote.
6. **Rastreabilidade:** toda leitura pela equipe gera auditoria (quem, qual aluno, quando), sem o valor.
7. **Retenção:** prazo de guarda da nota e dos cards: a definir. Cards são só do aluno.

## B. Política de Privacidade
1. Dizer em linguagem simples que a equipe de apoio pedagógico vê a nota de dificuldade e para que serve.
2. Dizer que a nota não é prova nem avaliação, e que é opcional.
3. Dizer que os cards de resumo são só do aluno.
4. Texto na tela do aluno (precisa ser igual ao do sistema): "A equipe de apoio pedagógico vê esta nota para ajudar você. Ela não é uma nota de prova."

## C. Mapa de Riscos (linhas novas)
| Risco | Mitigação prevista | Risco residual |
| --- | --- | --- |
| Nota vista como rótulo ou comparação entre alunos | Leitura por um aluno por vez; sem média, ranking ou lista com valores | Uso indevido fora do sistema (captura de tela) |
| Acesso indevido da equipe | Só o Pedagógico lê; auditoria de cada leitura | Abuso de quem tem acesso legítimo: revisar a auditoria |
| Aluno não sabe que a equipe vê | Texto literal na tela de marcação | Aluno que não lê |
| Dado sensível de menor visto sem consentimento específico | Base legal no parecer jurídico antes de dado real | Pendente |
| Nota usada como diagnóstico | Texto "não é avaliação nem diagnóstico" na tela e na Política | Interpretação errada pela equipe: orientar o NAPNE |
