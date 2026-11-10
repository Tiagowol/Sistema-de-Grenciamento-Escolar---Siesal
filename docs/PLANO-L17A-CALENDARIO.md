# Plano do L17a — Calendário do aluno (09/11/2026)

Estado: Implementado em 09/11/2026 (falta checagem humana: leitor de tela, teclado, contraste, zoom 200%, medição em 360, 768 e 1280 px). Migração 0011 provada em banco temporário; não aplicada ao banco do site.

## Estado anterior (lido no código)
- Tabela `evento` (migração 0006): tipos aula/estudo/pessoal/prova; origem manual/plano; sem identificador externo; sem edição; só criar, listar e desativar (`api/src/nucleo/rotas.ts`, seção Agenda).
- Tela Agenda: `web/src/paginas/Agenda.tsx`. Menu em `web/src/componentes/Shell.tsx`.

## Proposta
1. Migração 0011 (backup antes, retorno escrito): `evento` ganha `origem` com os valores manual, plano, google_agenda, google_sala_de_aula, calendario_escolar; `id_externo` opcional; tipos prova, trabalho, lembrete, compromisso além dos atuais; `oculto_em` (ocultar evento importado); tabela `evento_versao` (append-only) para cada criação, edição e desativação.
2. API: PUT /eventos/:id (só origem manual/plano; importado só pode ser ocultado), desativar grava versão, tudo com auditoria. Leitura inclui eventos da turma vinculada (calendário escolar, quando existir). Matriz de permissões nova versão (v7) com testes.
3. Tela "Calendário" abaixo de "Agenda": visões dia, semana, mês, ano; tempo concreto (hoje/amanhã, dia/mês, partes do dia com ícone, prazo em quadrados); teclado completo; leitor de tela anuncia a visão; 360, 768 e 1280 px; zoom 200%.
4. Testes: unitários, integração (permissão: aluno só os próprios e os da turma), axe.

## Pergunta em aberto (decisão do autor)
Ramo do L17a: criar `lote-17a-calendario` a partir do 802dac8 (recomendado: um ramo por lote, como nos anteriores) ou trabalhar em `lote-18-fechamento`. Os documentos de hoje (roteiro, registro de aprovações, CLAUDE.md, este plano) ficam sem commit até você autorizar.
