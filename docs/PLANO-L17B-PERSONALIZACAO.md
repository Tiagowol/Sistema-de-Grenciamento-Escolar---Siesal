# L17b — Personalização (09/11/2026)

Estado: Implementado (falta checagem humana: leitor de tela, teclado, contraste real, zoom 200%, medição em 360, 768 e 1280 px). Migração 0012 provada em banco temporário; **não aplicada ao banco do site** (backup antes e retorno em `docs/RETORNO-0012.md`).

## O que foi feito
1. Item "Personalizar" no menu do aluno: apelido, tema (claro, escuro, alto contraste), cor de destaque, tamanho da letra, reduzir movimento, tempo visual, tela inicial (Meu dia, Agenda ou Calendário) e "Voltar ao padrão".
2. Contraste: paleta fixa de 6 cores, cada uma com um valor por tema. Só vale cor com contraste de 4,5 para 1 contra o fundo e contra o texto do botão. A API recusa (422) o que não passa; a tela desabilita a cor e avisa. O teste `verificacao/paleta.test.ts` confere toda a paleta e confere que as 3 cópias do arquivo (shared, api, web) são iguais.
3. Preferências por usuário no banco (`preferencia_usuario`), com auditoria. Sem linha, vale o padrão acessível. Depois do login a tela carrega as do banco, então o aluno mantém a aparência em outro computador. As telas Acessibilidade e Personalizar gravam no mesmo lugar.
4. Tipos de atividade próprios (`tipo_atividade`): nome, cor e ícone; valem em Atividades e no Calendário; cada aluno vê só os seus; remover = desativar.
5. Matriz de permissões v8 (recurso `tipos_atividade`).

## Decisões
- A cor de destaque troca só `--primary`. No tema escuro, o texto do botão primário passou a ser escuro (`body.dark .btn-primary`), porque branco sobre azul claro não passava no contraste.
- "A personalização do aluno vence a da instituição" vale a partir do L19 (identidade da instituição). Hoje não há identidade visual da instituição.
- "Voltar ao padrão" não apaga a linha: grava os valores padrão e registra `preferencias.padrao` na auditoria.

## Falta
- Checagem humana e NAPNE. Aplicar a migração 0012 no banco do site (autorização separada).
