# ADENDO 2 AO PROJETO DOS LOTES 20a A 20d — SIESAL 4.0

Data: 10/11/2026, 23:10. Origem: mensagens do proprietário de 10/11/2026, 22:46 e 22:57.
Complementa `PLANO-L20A-A-L20D.md` e `ADENDO-1-L20A-A-L20D.md`. Onde divergirem, vale o documento mais novo.
Estado dos lotes 20a a 20d: **Planejado**. A execução de cada lote continua dependendo de "aprovo" próprio.

## 1. Aprovado pelo proprietário em 10/11/2026, 22:57
1. "Sim, incluir e registrar": os 3 preparos para o SUAP entram nos lotes 20b e 20c (seção 4).
2. "Atualize e documente tudo. Local e git": documentar no computador e no git.

## 2. Isolamento do aluno sem instituição (resposta à preocupação do proprietário)
1. Cada aluno sem instituição tem um espaço só dele. No banco, é uma instituição do tipo "individual", de uma pessoa só (mais o Responsável, se o aluno for menor).
2. A barreira é a RLS do PostgreSQL, a mesma que separa uma escola da outra. Um defeito na tela ou na API não faz o banco entregar linha de outro espaço.
3. Esse isolamento é mais forte do que o que existe hoje entre dois alunos da mesma escola (feito na API e provado por testes).
4. O Master vê só a quantidade de espaços individuais. Nunca nome, e-mail, CPF ou conteúdo.
5. Critério de entrega do 20c: teste automático de isolamento nos 3 sentidos — aluno A não lê o aluno B; individual não lê escola; escola não lê individual.

## 3. Tela inicial (texto final)
Uma pergunta, duas opções:
1. **"Vinculado a uma instituição"**: código da instituição, e-mail e senha (como hoje).
2. **"Sem instituição"**: e-mail e senha; botão "Criar conta" para quem ainda não tem.
A palavra usada em todas as telas é "instituição". Passar de "sem instituição" para "vinculado", levando os dados, continua na Parte 2.

## 4. Preparos para o SUAP (aprovados; entram agora)
| Onde | Campo | Lote |
| --- | --- | --- |
| Disciplina do aluno e catálogo | `origem` (catálogo, própria, suap) | 20b |
| Disciplina do aluno | `codigo_externo` (texto, opcional; evita duplicar na importação) | 20b |
| Cadastro do aluno | `matricula` (texto, opcional; liga a conta do SIESAL à do SUAP) | 20c |
Calendário e notas já têm o campo de origem (L17a e L19); o valor "suap" só entra na Parte 2.
Nenhuma chamada ao SUAP é feita na Parte 1. Estes campos ficam vazios até a integração.

## 5. Integração com o SUAP (Parte 2 — só desenho, nada aprovado para execução)
Só depois do retorno do professor e do NAPNE. A API do SUAP **não foi conferida nesta sessão**; o primeiro passo é ler a documentação oficial do IFRN.
1. O aluno autoriza na página do IFRN (OAuth2). O SIESAL não guarda a senha do SUAP; guarda só a chave temporária, cifrada.
2. Só leitura. O SIESAL nunca escreve no SUAP.
3. Importa: disciplinas do período, notas e faltas do próprio aluno, horários e calendário acadêmico.
4. Nunca importa a comparação com a média da turma (regra: sem comparação entre alunos).
5. Nota importada não substitui nota lançada: entra com origem "suap", data e versão.
6. Módulo "Integração SUAP" ligado ou desligado pelo Master, por instituição.
7. Serve também ao aluno sem instituição que estuda no IFRN.
Dependências externas: o IFRN autorizar o SIESAL como aplicação no SUAP; parecer jurídico e termo com a instituição antes de qualquer dado real.

## 6. Decisões — situação em 10/11/2026, 23:10
| # | Decisão | Situação |
| --- | --- | --- |
| D2 | CPF | Respondida: CPF do aluno e do responsável no cadastro do menor. Falta: aluno maior de 18 informa CPF? |
| D3 | Menor de 18 | Respondida: entra com autorização do responsável por e-mail |
| D6 | Disciplinas | Respondida: gerais marcadas, 10 campos no cadastro, máximo de 20 próprias |
| D9 | Preparos para o SUAP | **Aprovada** (22:57) |
| D1 | Espaço individual por aluno | Aguardando (20c) |
| D4 | Cadastro por convite na Parte 1 | Aguardando (20c). Observação: o proprietário descreveu "marca sem vínculo e faz o cadastro"; confirmar se é aberto ou por convite |
| D5 | Quem vê a dificuldade | Aguardando (20d) |
| D7 | Foto de documento | Aguardando. Recomendado: não |
| D8 | E-mail de validação na Parte 1 | Aguardando. Recomendado: caixa de teste no Docker |
| — | Divisão e ordem dos lotes 20a a 20d | **Aguardando "aprovo"** |

## Feito, Falta, Sugestões
**Feito:** registro do isolamento, da tela inicial, dos preparos do SUAP (aprovados) e do desenho da integração (Parte 2).
**Falta:** "aprovo" da divisão dos lotes e do L20a; decisões D1, D4, D5, D7 e D8, cada uma no seu lote; conferir a API do SUAP na documentação oficial.
**Sugestões:** perguntar ao professor, em 12/11/2026, quem no IFRN autoriza uma aplicação externa no SUAP.
