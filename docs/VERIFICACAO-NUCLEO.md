# Verificação do Núcleo (L6 a L11) — 08/11/2026

Estado: **Implementado**. Nada abaixo é "Verificado" no Docker do autor ainda.

## O que foi testado (ambiente do Claude: Node 26, PostgreSQL 18.6 real)
| Item | Como | Resultado |
| --- | --- | --- |
| Unitários (matriz, auth, plano, telas, axe-core) | `pnpm teste` | 344 passam |
| Integração (RLS, auth, cadastro, Núcleo) | `vitest.integracao.config.ts` com PostgreSQL 18.6 | 70 passam |
| Fumaça ponta a ponta | migrações 0001–0006, job `instituicao`, API compilada, site compilado com proxy `/api`: login, senha errada (401), criar tarefa, plano, Meu dia, sem cookie (401), asset JS | passou |
| Lint e tipos | Biome, `tsc` de shared, web e api | passam |

## O que as provas cobrem
- Aluno A não vê nem altera dados do aluno B (mesma instituição) nem de outra instituição (RLS).
- Professor recebe 403 nas rotas do aluno. Sem sessão recebe 401.
- Nada é apagado: remoção grava `desativado_em`. Auditoria encadeada continua íntegra.
- Notas pessoais: média só do próprio aluno, sem ranking e sem comparação.

## O que ainda depende de pessoas (não automatizável aqui)
1. Leitor de tela (NVDA ou VoiceOver): percorrer Meu dia, Atividades, Agenda, Modo foco, Notas e Avisos.
2. Teclado: Tab/Shift+Tab em todas as telas; foco sempre visível; nenhum botão inacessível.
3. Contraste das cores nos temas claro, escuro e alto contraste (o axe em jsdom não mede cor).
4. Zoom de 200% e fonte 150%; celular em retrato (menu lateral).
5. Revisão por pessoa do NAPNE: textos curtos e literais.
6. Restauração de backup: `scripts/backup.sh` + restaurar em banco limpo (passos no README).

## Lacunas conhecidas
- Notas oficiais lançadas por professor, turmas e vínculos: ainda não existem (Parte 1, depois do Núcleo).
- Lembretes são gerados quando o aluno abre o sistema (sem pg-boss). Push e e-mail: Parte 2.
- Modo foco não tem "pausar": há "Parar por agora" e iniciar outro bloco.
- Login dos Masters adiado.
