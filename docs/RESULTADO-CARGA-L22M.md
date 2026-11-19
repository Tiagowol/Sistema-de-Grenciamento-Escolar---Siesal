# RESULTADO do teste de carga L22m — 18/11/2026

Estado: **executado no notebook do autor** (Q1 da proposta), com os mesmos limites de memória e processador do `compose.yaml`. É medição neste notebook e **projeção** para um servidor do mesmo tamanho. Ambiente de carga separado (`siesal-carga`), dados fictícios, apagado no fim de cada rodada. Site e banco do autor não mudaram.

## Resultado em uma linha
**Uso normal: aprovado até 1000 alunos em 10 instituições** (0 erros, 95% das telas em até 52 ms, API com até 216 MB e banco com até 110 MB). **Pico de entrada: reprovado.** Com 320 pessoas entrando nos mesmos 30 segundos, metade não conseguiu entrar. A causa é a conferência da senha feita dentro da transação do banco, que esgota as conexões.

## Como foi medido
- Ferramenta: k6 1.0.0 (imagem Docker oficial), falando direto com a API, sem o nginx (o nginx só serve arquivos estáticos e não pesa).
- Contas por rodada (fictícias): 10 Admins, 10 Pedagógicos, 1 professor para cada 15 alunos, 1 responsável por aluno. Por aluno: 10 atividades, 5 compromissos e 10 notas. 3 avisos por turma.
- Cada usuário simulado entra uma vez e abre telas com pausa de 5 a 15 segundos entre elas. Aluno: Meu dia, Atividades, Agenda, Notas oficiais e sino. Professor: turmas, notas, pedidos de revisão e sino.
- Rodadas de 10 minutos: 1 minuto subindo, 8 minutos estável, 30 segundos descendo. Uso simultâneo de cerca de 15% das contas que entram. Pico: o dobro de pessoas, todas entrando em 30 segundos.
- Memória e processador amostrados a cada 5 segundos. Processador em % de 1 núcleo; limites: API 0,5 núcleo (50%), banco 1 núcleo (100%).

## Números medidos

| Rodada | Contas | Simultâneos | Pedidos/s | Erros | Telas: mediana / p95 / máx. | API memória (média / pico) | API CPU pico | Banco memória (média / pico) | Banco CPU pico | Tamanho do banco |
|---|---|---|---|---|---|---|---|---|---|---|
| 100 alunos | 240 | 20 | 2,0 | 0% | 16 / 41 / 316 ms | 168 / 186 MB | 22% | 60 / 77 MB | 10% | 13 MB |
| 500 alunos | 1.060 | 80 | 7,9 | 0% | 14 / 36 / 194 ms | 196 / 214 MB | 21% | 77 / 92 MB | 12% | 18 MB |
| 1000 alunos | 2.090 | 160 | 15,7 | 0% | 13 / 52 / 1.146 ms | 196 / 216 MB | 43% | 89 / 110 MB | 17% | 24 MB |
| Pico (1000 alunos) | 2.090 | 320 em 30 s | 31,6 | 48,9%* | 9 / 59 / 8.497 ms | 201 / 217 MB | 51% | 97 / 132 MB | 20% | 24 MB |

\* Na rodada de pico, 153 das 320 entradas falharam e houve 84 respostas 500 em telas. O resto dos 48,9% são telas abertas sem sessão por quem não entrou (efeito do roteiro).

**Rodada de diagnóstico do pico** (o roteiro tenta entrar de novo a cada 10 s, como uma pessoa faria): 99,9% de falha. As novas tentativas pioraram a fila. A API registrou 2.567 vezes a mesma mensagem: *"Unable to start a transaction in the given time"*. As amostras de memória e processador desta rodada falharam (só 1 amostra), por isso não entram na tabela.

## Onde travou (pico)
1. Toda chamada abre uma transação no banco (`withTenant`), e o grupo de conexões da API tem 10 conexões (padrão do driver).
2. No login, a senha é conferida com argon2 (19 MB de memória, 2 passadas) **dentro** dessa transação. A conexão fica presa durante o cálculo.
3. Com 0,5 núcleo para a API, muitos logins juntos fazem o cálculo demorar mais. As 10 conexões ficam presas, e os pedidos seguintes desistem depois de 2 segundos de espera (erro 500).
4. A memória **não** foi o problema: a API não passou de 217 MB e nunca foi reiniciada.

## Tamanho de servidor (agora medido)
Soma dos picos em uso normal com 1000 alunos: API 216 MB + banco 110 MB + site e proxy cerca de 16 MB = **cerca de 340 MB**.

| Cenário | Memória do servidor | Processador | Disco | Observação |
|---|---|---|---|---|
| até 500 alunos | 1 GB | 1 núcleo | 20 GB | folga grande; montar as imagens fora do servidor |
| 1000 alunos, 10 instituições | 2 GB | 2 núcleos | 40 GB | 1 GB funciona no uso normal, mas sem folga para o sistema, o backup e picos |
| pico de entrada (turma inteira entrando junto) | — | — | — | **precisa da correção abaixo**, não de servidor maior |

Disco: o banco foi de 13 MB (100 alunos) a 24 MB (1000 alunos) com os dados semeados. O crescimento real virá do uso diário e da auditoria; continua sendo estimativa.

## Limites deste teste (fato, não esconder)
- Notebook, não servidor: disco e processador diferentes. Os limites do Docker aproximam, mas não igualam.
- O autor pôde usar o site externo durante as rodadas (avisado); um uso leve pesa pouco perto de 160 a 320 usuários simulados.
- Admin ficou fora do roteiro (exige o segundo fator). Responsáveis e Pedagógico não navegaram; só existiam como contas.
- Telas de escrita (lançar nota, criar atividade) não entraram; só leitura.
- A API ficou com 216 de 256 MB no uso normal (85% do limite). Não houve falha, mas a folga é pequena.

## Sugestões (cada uma precisa de lote e aprovação próprios)
1. **Corrigir o pico de entrada:** conferir a senha **fora** da transação do banco (ler o hash, fechar a transação, conferir, abrir outra para gravar) e aumentar o tempo de espera por conexão. Depois, repetir só a rodada de pico.
2. Subir o limite de memória da API de 256 MB para 384 MB.
3. Ver por que 804 tentativas de login da rodada de diagnóstico voltaram 401 (provável bloqueio por tentativas; não investigado).

## Como repetir
`bash verificacao/carga/rodar.sh NOME ALUNOS SIMULTÂNEOS SUBIDA DURAÇÃO` (ex.: `r1000 1000 160 1m 8m`). Os resultados brutos ficam em `verificacao/carga/resultados/`, fora do git.

## Feito, Falta e Sugestões
- **Feito:** 4 rodadas e 1 rodada de diagnóstico; ambiente apagado depois de cada uma; este relatório.
- **Falta:** commit dos arquivos do teste (`verificacao/carga/` e a linha nova do `.gitignore`), pelo autor.
- **Sugestões:** as 3 acima, na ordem.
