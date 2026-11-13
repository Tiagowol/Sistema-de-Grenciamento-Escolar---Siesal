# Estado real — fim da sessão de 13/11/2026

## Onde está
- Pasta `C:\TW1-DEV\siesal-4`, ramo de trabalho **`lote-21-22-fechamento`** (criado hoje a partir de `claude/f053-l20-verification-itcpd9`, que fica só como cópia).
- Último commit de código/estado antes deste fechamento: **`f92e89d`** (no GitHub, igual ao local). Commits de código de hoje: `11118c5` (L22a-2 e L22a-2b juntos) e `b3e475e` (prazo em palavra e data). Sem merge em `siesal-4` nem em `main`.

## O que está aplicado no site local (http://localhost:18080)
- Migrações **0027** (L22a-1c, aplicada de manhã), **0028** (L22a-2) e **0029** (L22a-2b), 29 migrações no total. Backups: `backups/siesal-20261112-174256.dump` (antes da 0027) e `backups/siesal-20261113-191326.dump` (antes da 0028 e da 0029).
- API e site reconstruídos com o código do `b3e475e`; saúde ok.

## O que está testado por máquina
- Integração 361 de 361; tipos ok; 1284 testes de unidade e tela (axe sem violação nas telas novas); lint dos arquivos novos ok. O lint do repositório inteiro não foi refeito (sem pnpm no computador; rodei em contêiner descartável).
- Conferido no navegador do app em 360, 768 e 1280 px (sem rolagem horizontal, alvos de 44 px): tela da professora ("Alunos que você acompanha") e da representante legal ("Quem pode ver meus dados"), com fluxo real de convite, aceite e leitura.

## O que NÃO foi verificado por humano
- **Checagem humana** (leitor de tela, teclado, contraste, NAPNE) de L22a-1b, L22a-1c, L22a-2 e L22a-2b. O estado de todos é "Implementado e aplicado", **não "Verificado"**.
- **T1 a T4 do guia** (`segredos-locais/GUIA-DE-TESTES-2026-11-13.txt`): por conta do autor, fora desta sessão.
- **Tela "Pedidos de acompanhamento"** (Admin e Pedagógico): nunca vista no navegador. Pendência aberta, sem prazo.
- Envio de e-mail real, validade pelo calendário escolar real da instituição (só testes), parecer jurídico (L25).

## Decisão registrada para o próximo lote (L22a-3, a propor em chat novo)
- A seção "Aluno menor de idade" só para quem se cadastrou como representante legal (A-090). Muda o T6 do guia.
- Também em aberto para o L22a-3: "representante vê tudo, só leitura" e o vínculo do representante indicado.

## Resíduo no banco do site (dados fictícios)
- Contas do guia (`rep.ficticio`, `prof.ficticio`, `ped.ficticio`) e 3 convites de teste (válidos até 19/11/2026); contas `conf.rep.*`, `conf.prof.*`, `conf.aluno.*` de conferência, um espaço individual de conferência e um convite (`criado_por = conferencia-layout-13-11`). Podem ser desativados depois (`desativada_em`).

## Falhas registradas hoje
- Push dos documentos levou o commit de código `11118c5` ao ramo remoto antes da autorização (registrado na A-088; depois o push foi autorizado e feito).
