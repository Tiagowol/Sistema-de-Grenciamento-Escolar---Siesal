# REGISTRO DE FALHAS E RETORNO — SIESAL 4.0

Toda falha corrigida entra aqui, no procedimento. Falha de segurança, dados, escopo, prazo ou não resolvida também vira 1 linha na mensagem. Registro nunca é apagado. A cópia completa, com data, causa, correção e retorno de cada falha, fica no projeto do Claude em `claude/lote-0/REGISTRO-DE-FALHAS.md`.

| ID | Data | Resumo | Situação |
| --- | --- | --- | --- |
| F-001 | 07/11/2026 | Ambiente do Claude sem Docker, banco e instalação de pacotes. Validação no PC do autor | aberta |
| F-002 | 07/11/2026 | Leitura do arquivo do padrão TI-REX excedeu o limite. Leitura por faixas | corrigida |
| F-003 | 07/11/2026 | Segredos no histórico do repositório público v3. Proprietário aceitou o risco (A-004) | risco aceito |
| F-004 | 07/11/2026 | Docker indisponível no terminal do app. Comandos rodam no WSL2 do autor | corrigida |
| F-005 | 07/11/2026 | Commit recusado por falta de identidade no git. Identidade local configurada | corrigida |
| F-006 | 07/11/2026 | Autenticação no GitHub falhou no push. Resolvido com convite de colaboradora, token e push em 07/11/2026 20:35 | corrigida |
| F-007 | 07/11/2026 | Arquivos temporários vazios do pnpm em `api/`. Apagados | corrigida |
| F-008 | 07/11/2026 | `.pnpm-store/` e `_tmp_39_1d36b93e/` na raiz, fora do `.gitignore`. Corrigido em 07/11/2026: `.gitignore` ajustado e as 2 pastas (vazias) apagadas. Retorno: `git revert` do commit | corrigida |
| F-009 | 07/11/2026 | Pasta `siesal-4` não aparece como conectada no chat do Claude. Arquivos criados pelo WSL2 | aberta |
| F-010 | 07/11/2026 | Saída de comando colada no terminal como se fosse comando. Só gerou erros, sem alteração | corrigida |
| F-011 | 07/11/2026 | Token recusado na 1ª tentativa de envio (provável erro ao colar). A 2ª tentativa funcionou | corrigida |
