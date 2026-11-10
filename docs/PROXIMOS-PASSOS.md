# Próximos passos (registro de 09/11/2026)

> **Atualização de 10/11/2026:** os lotes L17, L17a, L17b, L17c e L18 estão **Implementados** (migrações até a 0014 aplicadas no banco do site). A ordem abaixo é histórica. O estado atual, o que falta e o gate de verificação estão em `docs/RELATORIO-L18.md`. Próximos lotes: L19 e L20, cada um só com "aprovo".

Estado: L16, L16a, L16b, L16c, L16d e L16e commitados no ramo `lote-16-avisos` (um commit só; os arquivos se misturam entre os sublotes). Estado dos lotes: **Implementado**, não "Verificado".

## Ordem
1. **Autor:** checagens humanas do L16 (leitor de tela, teclado, zoom 200%, contraste, outros navegadores, NAPNE revisa o manual).
2. **Autor:** conferir o Funnel (`& 'C:\Program Files\Tailscale\tailscale.exe' funnel status`) e o túnel da Cloudflare (`docker ps`).
3. **Code:** medir os perfis restantes, os temas escuro e alto contraste e a tela "Prazo passou" (360, 768 e 1280 px).
4. **Autor:** decidir o escopo do L17 (Apoio ao aluno, com "Linguagem curta" revisada pelo NAPNE). O Code escreve a proposta curta; sem código antes da aprovação.
5. **L18:** Fechamento, com login dos Masters (tabela `operator_account`; falta login, painel e TOTP).

## L17 (09/11/2026): Implementado, medição adiada pelo autor
- Falta medir no navegador (360, 768 e 1280 px; temas claro, escuro e alto contraste): Meu dia com o cartão "Escolha o que fazer agora", Atividades com "Preciso de ajuda", Acessibilidade e o sino Mensagens (aluno, professor e `napne@teste.com`).
- Como fazer: o autor abre o painel do navegador (Ctrl+Shift+B), entra em http://localhost:18080 com `aluno@teste.com` e avisa o Code.
- Falta também: revisão dos textos pelo NAPNE (`web/src/linguagem-curta.ts`) e o commit do L17.

## Pendências sem lote
- **F-036:** o commit d428548 (L15) tem o defeito; está corrigido no L16. Não enviar o L15 sozinho ao GitHub.
- Texto da A-029 (comandos manuais de manutenção): os nomes são do Code; o arquivo `claude/lote-16a-e/PROPOSTA-LOTES-16A-A-16E.md` não está no repositório.
- Docker Scout (CVEs das imagens), tela de Admin com TOTP, varredura de segredos no histórico do Git, carga pelo nginx, ensaio de restauração.

## Varredura da documentação (09/11/2026)
Falhas abertas: só **F-001** e **F-009** (limitações do ambiente do Claude, contornadas). A **F-042** (Funnel) está fechada: o link `https://siesal.tail378cb5.ts.net` abre fora da rede (confirmado pelo autor).

Documentos desatualizados: corrigidos em 09/11/2026 (F-038, J6, K5, N2, título da F-042, endereço do Funnel no relatório e linha "Lote 6" do README).

Testes nunca feitos (ficam para depois, decisão do autor de 09/11/2026) (plano de testes): A2 troca da senha provisória; B7 e C7 exploratórios; D10 duas revisões ao mesmo tempo; F3 a F6 (XSS, SQL injection, Unicode, corpo grande); G5 a G7 (TLS, cache, CORS); I4 e I5 (retorno da migração e restauração); J9 e J10 (zoom de 200% e movimento); L4 (rastreadores); N4 (`pnpm audit`); N5 (imagens base); N6 (carga).

Conta de teste nova: `napne@teste.com`, perfil Pedagógico (o sistema não tem perfil NAPNE). Senha só em `backups/credenciais-napne.txt`.

## Regras que continuam
Um lote por vez, aprovação própria, proposta curta antes do código. Merge e deploy exigem autorizações separadas.
