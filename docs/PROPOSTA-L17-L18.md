# Proposta curta: L17 e L18 (09/11/2026)

Estado: **proposta, sem código**. Cada lote precisa do "sim" do autor, um por vez (CLAUDE.md, seção 3).
Fonte do escopo: `RELATORIO-SESSAO-L16-A-L16E.md` (seção 4) e `PLANO-L16A-CORRECOES-DA-AUDITORIA.md` (seções 4 e 6).
O que está marcado como **"a decidir"** não vem dos documentos: é sugestão minha.

## L17: Apoio ao aluno (ramo `lote-17-apoio`)
| Item | O que fazer | Critério de pronto |
|---|---|---|
| 1. Linguagem curta | Opção em Acessibilidade, **desligada por padrão**, que troca os textos das telas do aluno (Meu dia, Atividades, Agenda, Foco) por frases curtas e literais ("Vamos por partes", "Escolha o que fazer agora"). Todos os textos ficam em um arquivo só (`web/src/linguagem-curta.ts`), para a revisão do NAPNE | Liga e desliga; grava no aparelho; axe sem violação; nenhum texto com pressão, ironia ou metáfora; revisão do NAPNE com a conta `napne@teste.com` |
| 2. "Escolha o que fazer agora" | No Meu dia, um cartão opcional que mostra **uma** etapa por vez, com 3 botões: "Começar" (abre o Foco com o bloco da etapa), "Mostrar outra" e "Agora não" (sem punição). Tempo concreto: palavra, dia/mês e forma visual | Teclado e leitor de tela; 44 px; 360, 768 e 1280 px; "Agora não" não grava nada contra o aluno |
| 3. Pedir ajuda (**aprovado em 09/11/2026**, ao professor e ao NAPNE/Pedagógico) | Botão "Preciso de ajuda" na atividade e no cartão; o aluno escolhe o professor da turma ou a equipe pedagógica (NAPNE) e o que aconteceu; o pedido chega no sino Mensagens. Migração 0010 e matriz v6 | Testes de integração (isolamento, perfil, gatilhos); axe; 44 px |

**Estado do L17 (09/11/2026): Implementado.** Itens 1, 2 e 3 feitos; 647 testes unitários e 156 de integração passando; migração 0010 aplicada com backup (`docs/RETORNO-0010.md`). Falta: medição no navegador (360, 768, 1280 px), checagem humana e revisão do NAPNE.

Sem migração nos itens 1 e 2. Estimativa (minha, não medida): itens 1 e 2, cerca de 1 dia; item 3, mais 1 dia.

## L18: Fechamento, com login dos Masters
| Item | O que fazer | Critério de pronto |
|---|---|---|
| 1. Login do Master | Entrada separada (`/operacao`), com nome de usuário da `operator_account` (`w1lopes`, `tw1lopes`), senha definida no 1º acesso e **TOTP obrigatório**. Cookie próprio, sem acesso a dado escolar | Testes de integração: sem TOTP não entra; Master não lê tabela escolar (RLS); bloqueio por tentativas; auditoria |
| 2. Painel do Master | Listar, criar e suspender instituições (só o que a matriz já dá ao Master: `plataforma`) | Matriz v6 com testes; axe; 360, 768 e 1280 px |
| 3. Fechamento | Atualizar README e documentos desatualizados (ver `PROXIMOS-PASSOS.md`); lista final do gate de verificação | README sem divergência; nenhuma falha marcada "aberta" que já foi corrigida |

Migração provável (0010) para a senha e o TOTP do Master, com backup antes e retorno escrito. Estimativa (minha): 1,5 a 2 dias.

## Decisões para o autor
1. Aprovar o L17 com os itens 1 e 2, e decidir se o item 3 entra.
2. O L18 só começa depois do L17 entregue.
