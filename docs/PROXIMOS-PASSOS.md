# Próximos passos (registro de 09/11/2026)

Estado: L16, L16a, L16b, L16c, L16d e L16e commitados no ramo `lote-16-avisos` (um commit só; os arquivos se misturam entre os sublotes). Estado dos lotes: **Implementado**, não "Verificado".

## Ordem
1. **Autor:** checagens humanas do L16 (leitor de tela, teclado, zoom 200%, contraste, outros navegadores, NAPNE revisa o manual).
2. **Autor:** conferir o Funnel (`& 'C:\Program Files\Tailscale\tailscale.exe' funnel status`) e o túnel da Cloudflare (`docker ps`).
3. **Code:** medir os perfis restantes, os temas escuro e alto contraste e a tela "Prazo passou" (360, 768 e 1280 px).
4. **Autor:** decidir o escopo do L17 (Apoio ao aluno, com "Linguagem curta" revisada pelo NAPNE). O Code escreve a proposta curta; sem código antes da aprovação.
5. **L18:** Fechamento, com login dos Masters (tabela `operator_account`; falta login, painel e TOTP).

## Pendências sem lote
- **F-036:** o commit d428548 (L15) tem o defeito; está corrigido no L16. Não enviar o L15 sozinho ao GitHub.
- Texto da A-029 (comandos manuais de manutenção): os nomes são do Code; o arquivo `claude/lote-16a-e/PROPOSTA-LOTES-16A-A-16E.md` não está no repositório.
- Docker Scout (CVEs das imagens), tela de Admin com TOTP, varredura de segredos no histórico do Git, carga pelo nginx, ensaio de restauração.

## Regras que continuam
Um lote por vez, aprovação própria, proposta curta antes do código. Merge e deploy exigem autorizações separadas.
