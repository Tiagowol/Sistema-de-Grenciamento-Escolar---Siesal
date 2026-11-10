# Plano de testes da auditoria do SIESAL L16

Data: 08/11/2026. Estado do sistema: **Implementado**, não Verificado. Escopo: L16 (sino Mensagens, sino Prazos, caixa, avisos curtos, "fechar juntos") e o que ele toca (sessão, permissões, notas oficiais, banco).
Sistema projetado para atender LGPD, ECA Digital (Lei 15.211/2025), WCAG 2.2 AA e eMAG. "Em conformidade" só depois de parecer jurídico.
Todos os dados são fictícios. Contas de auditoria: Aluno (2), Professor, Responsável e Pedagógico. Não há conta Master nem Admin nesta auditoria. As senhas não constam deste relatório.

Legenda da situação:
- **OK-auto**: já coberto por teste automatizado que passou (557 unitários, 133 de integração, 104 verificações pela URL HTTPS).
- **OK-ver**: verificado por mim na URL HTTPS em 08/11/2026.
- **Humano**: precisa de pessoa (leitor de tela, teclado, olhar, jurídico, NAPNE).
- **Aberto**: falha conhecida, ainda não corrigida.
- **Não feito**: ainda não executado por ninguém.

## 1. Sessão e autenticação
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| A1 | Login válido | Entrar com cada conta | 200; senha provisória exige troca | OK-ver |
| A2 | Troca da senha provisória | Trocar a senha no 1º acesso | Senha nova aceita; a provisória deixa de valer | Não feito (preserva as contas) |
| A3 | Cookie | Inspecionar `Set-Cookie` no login | `__Host-siesal_sessao`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, sem `Domain` | OK-ver |
| A4 | Logout | Sair e reusar o token antigo | 204; token antigo dá 401 | OK-ver |
| A5 | Token inventado e cookie sem prefixo | Enviar cookie falso | 401 | OK-ver |
| A6 | Bloqueio por tentativas | 5 senhas erradas seguidas | Conta bloqueada por 15 min; tudo auditado | OK-auto (não repetido no túnel) |
| A7 | Limite por IP | 11+ logins em 1 min | 429 depois de 10; ignora `X-Forwarded-For` e `X-Real-IP` do cliente | OK-ver |
| A8 | Mensagem de falha | Errar e-mail e errar senha | Mesma mensagem nos dois casos (sem revelar se a conta existe) | OK-auto |
| A9 | Expiração e revogação da sessão | Esperar o vencimento; desativar o usuário | Sessão deixa de valer | OK-auto (não medido no túnel) |
| A10 | TOTP do Admin | Ativar e entrar com código | Exige segundo fator | OK-auto; **tela do Admin não conferida** (Humano) |
| A11 | Entrada por HTTP | Abrir `http://` | Sem sessão (cookie `Secure`) | OK-ver (a Cloudflare responde 200 em HTTP; ver F-risco 1) |

## 2. Autorização (deny by default, matriz v5)
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| B1 | Sem sessão | Chamar cada rota protegida | 401 | OK-ver |
| B2 | Perfil sem permissão | Aluno, responsável, professor e pedagógico chamam rotas de outro perfil | 403 e tentativa auditada | OK-ver / OK-auto |
| B3 | Publicar aviso | Só Pedagógico e Admin | Demais perfis: 403 | OK-auto |
| B4 | Lançar e revisar nota | Só o professor que lançou, com vínculo | Outros: 403 | OK-auto |
| B5 | Master | Nenhum acesso escolar | Negado na matriz e sem sessão escolar | OK-auto |
| B6 | Matriz gera testes | Conferir `permissoes.json` v5 x política | Sem divergência | OK-auto |
| B7 | Escalada horizontal | Trocar IDs na URL e no corpo (nota, pedido, aviso, usuário) | 404 ou 403, nunca dado alheio | OK-auto; **Não feito** de forma exploratória por humano |

## 3. Isolamento
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| C1 | Entre usuários da mesma turma | Aluno 1 x aluno 2 | Cada um vê só a própria nota, tarefa e caixa | OK-ver |
| C2 | Responsável | Ver só o aluno vinculado | Sim | OK-ver |
| C3 | Entre turmas | Professor sem vínculo | Não vê pedido nem nota | OK-auto |
| C4 | Entre instituições | Escola B x Demonstração | Não vê nota, aviso nem pedido; 404 ao agir | OK-ver |
| C5 | Login cruzado | Conta da B pela instituição da Demonstração | 401 | OK-ver |
| C6 | RLS no banco | Consulta sem contexto e com contexto de outra escola | Zero linhas; gravar em outra escola é recusado | OK-auto |
| C7 | Teste de injeção de tenant | Forjar `instituicao_id` no corpo | Ignorado ou recusado | Não feito (exploratório) |

## 4. Funcionalidades do L16
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| D1 | Sino Mensagens, professor | Pedidos abertos das suas turmas | Mostra; some ao responder | OK-ver |
| D2 | Sino Mensagens, demais perfis | Resposta (revisada ou mantida) a pedido próprio | Só o seu | OK-auto |
| D3 | Contagem e "visto" | Abrir a caixa | Contagem zera; auditoria só se mudou estado | OK-auto |
| D4 | Fechar juntos | Revisar nota com 2 pedidos abertos | Os 2 fecham como "revisada", ligados à nova versão, na mesma transação | OK-ver |
| D5 | Revisão sem indicar pedido | Revisar sem `pedido_id` | Também fecha os abertos | OK-auto |
| D6 | Revisão recusada | Valor igual ao atual | Nenhum pedido fecha | OK-auto |
| D7 | Aviso de turma e da instituição | Pedagógico (turma) e Admin (escola) | Chega só a quem deve | OK-auto / OK-ver (turma) |
| D8 | Desativar aviso | Autor ou Admin | Some da caixa; nada se apaga | OK-auto |
| D9 | Sino Prazos | Só o aluno; contagem hoje e amanhã | Correto; tarefas sem prazo não entram | OK-auto; **Humano** (ver na tela) |
| D10 | Duas revisões ao mesmo tempo | Disparar 2 revisões da mesma nota | Nenhuma versão duplicada (trava) | Não feito |
| D11 | Limites | 300 itens por lista; 300 caracteres | Truncamento e recusa corretos | OK-auto |

## 5. A-027 (motivo da revisão e versões antigas)
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| E1 | Pedagógico | Ler `/caixa`, `/pedidos-revisao`, `/notas-oficiais` | Sem motivo, sem versões antigas, sem número de versão | OK-ver |
| E2 | Aluno e responsável | Mesmas rotas | Idem | OK-ver |
| E3 | Professor e Admin | Histórico e motivo | Visíveis | OK-ver (professor); Admin OK-auto |
| E4 | Motivo de "mantida" | Quem pediu x os demais | Só quem pediu e o professor | OK-auto |
| E5 | Tela e corpo bruto | Procurar o motivo no HTML, no JSON e nos logs | Ausente | OK-ver (JSON); **Humano** (tela) |
| E6 | Defeito do L15 (F-036) | Commit d428548 ainda tem a falha | Só corrigido no L16 | Aberto: não fazer push do L15 sozinho |

## 6. Entrada de dados e injeção
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| F1 | Texto longo, vazio e campos extras | 301 caracteres, só espaços, campo inesperado | 400 | OK-auto |
| F2 | Links e anexos | `https://`, `www.`, `://` | 400; sem anexos | OK-auto |
| F3 | XSS | `<script>`, `<img onerror>`, HTML no aviso e no pedido | Exibido como texto, nunca executado | Não feito (exploratório); React escapa por padrão |
| F4 | SQL injection | Aspas, `'; DROP`, no texto, na URL e nos parâmetros | Sem efeito (consultas parametrizadas) | Não feito (exploratório) |
| F5 | Unicode e direção | Emojis, RTL, caracteres de controle | Aceito ou recusado de forma segura | Não feito |
| F6 | Corpo grande | Corpo maior que 1 MB | Recusado pelo nginx | Não feito |
| F7 | JSON malformado e tipos errados | Número onde se espera texto | 400, sem erro 500 | OK-auto (parcial) |

## 7. Transporte e cabeçalhos
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| G1 | CSP `default-src 'self'; frame-ancestors 'none'` | Presente | OK-ver |
| G2 | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | Presentes | OK-ver |
| G3 | `Permissions-Policy` na página inicial | Presente | **Aberto (F-038)** |
| G4 | HSTS | Presente em produção | Não aplicável ao túnel temporário; definir em produção |
| G5 | TLS (versão e cifras) | TLS 1.2 ou superior | Não feito (Cloudflare termina o TLS) |
| G6 | Cache de dados sensíveis | Respostas da API sem cache compartilhado | Não feito |
| G7 | CORS | Mesma origem; sem `Access-Control-Allow-Origin: *` | Não feito (verificar) |
| G8 | Sem versão do servidor | `server_tokens off` | OK-ver |

## 8. Auditoria e rastreabilidade
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| H1 | Cadeia de hash íntegra | Sem quebra, em ambas as escolas | OK-auto |
| H2 | Append-only | UPDATE e DELETE recusados | OK-auto |
| H3 | Eventos do L16 | `aviso.publicado`, `aviso.desativado`, `caixa.aberta`, `pedido_revisao.respondido` (marca "fechado junto") | OK-auto |
| H4 | Negativas auditadas | `avisos.acesso_negado`, `aviso.desativacao_negada` | OK-auto |
| H5 | Dados semeados para a auditoria | Foram inseridos por script, **sem** eventos de criação na trilha | Limitação conhecida; registrar |
| H6 | Sem senha, token nem texto de pedido nos logs | Logs da API e do nginx | OK-ver (parcial; um incidente de tela já registrado) |

## 9. Banco de dados e migração 0009
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| I1 | RLS ativa e forçada nas 2 tabelas novas | `relrowsecurity` e `relforcerowsecurity` verdadeiros | OK-ver |
| I2 | Permissões do papel `siesal_app` | `aviso_visto`: só SELECT e INSERT; `aviso_escolar`: SELECT, INSERT e UPDATE (só para desativar) | OK-auto |
| I3 | Gatilhos | Perfil e escopo do autor; texto sem link; só desativa | OK-auto |
| I4 | Retorno da migração | Restaurar o backup, ou o SQL de `RETORNO-0009.md` | Não feito (testar em cópia do banco) |
| I5 | Restauração do backup | `pg_restore` do dump em banco vazio | Não feito |
| I6 | Backups fora do git | `backups/` ignorado | OK-ver |

## 10. Acessibilidade (WCAG 2.2 AA e eMAG)
| ID | Teste | Como | Esperado | Situação |
|---|---|---|---|---|
| J1 | axe automático | Painéis dos sinos e página "Avisos da escola" | Sem violações (o axe do jsdom não mede contraste) | OK-auto |
| J2 | Contraste dos sinos | Cálculo a partir do CSS, claro e escuro | Texto 4,5:1; borda e foco 3:1 | OK-auto |
| J3 | Contraste real na tela | Ferramenta de contraste no navegador, nos 3 temas (claro, escuro, alto contraste) | Mesmo resultado | **Humano** |
| J4 | Teclado | Tab, Enter, Espaço e Esc nos dois sinos | Abre, fecha, foco volta ao botão | OK-auto; **Humano** |
| J5 | Leitor de tela | NVDA (Windows), VoiceOver (iOS e macOS), TalkBack (Android) | Nome "Mensagens, N não vistas" e "Prazos, N atividades para hoje ou amanhã"; contagem anunciada | **Humano** (checagem NAPNE) |
| J6 | Foco visível | Todos os controles | Contorno de pelo menos 3:1 | Sinos OK; **foco global tem cerca de 2,9:1 (Aberto, candidato ao L17)** |
| J7 | Alvos de toque | Botões do topo e dos painéis | 44 px ou mais | OK-ver (360, 768 e 1280 px) |
| J8 | Responsividade | 360, 768 e 1280 px | Sem rolagem horizontal | OK-ver (aluno e professor); **Humano** nos demais perfis |
| J9 | Zoom e texto | 200% de zoom; fonte maior; espaçamento de texto | Sem perda de conteúdo | Não feito |
| J10 | Movimento e sons | "Reduzir movimento"; som desligado por padrão | Respeitado | Não feito |
| J11 | Ordem de leitura e títulos | Estrutura de títulos e regiões nos painéis | Lógica | OK-auto (parcial); **Humano** |

## 11. Tempo concreto e linguagem (regras de produto)
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| K1 | Tempo nunca só em número | Palavra ("hoje", "amanhã"), data em dia/mês e forma visual | OK-ver |
| K2 | Sem "atrasado" como alerta nos sinos | Texto neutro, sem vermelho | OK-auto |
| K3 | Texto literal, sem pressão, sem ironia | Revisão de todos os textos novos | **Humano** |
| K4 | Sem ranking nem comparação entre alunos | Nenhuma tela ou rota | OK-auto |
| K5 | Página "Avisos" do aluno ainda usa selo vermelho "Prazo passou" | Contra a regra de tempo concreto | **Aberto (candidato ao L17)** |

## 12. Privacidade, LGPD e ECA Digital
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| L1 | Dados fictícios apenas | Sem dado real no banco do ambiente | OK-ver (e-mails `*.invalid`) |
| L2 | Minimização | A caixa mostra só o necessário (sem motivo, sem versões) | OK-auto |
| L3 | Aviso para menores | Só leitura, sem resposta, sem link e sem anexo | OK-auto |
| L4 | Sem rastreadores nem recursos externos | Nenhuma chamada a terceiros no carregamento da página | Não feito (verificar rede do navegador) |
| L5 | Cookies | Só o cookie de sessão, `HttpOnly` | OK-ver |
| L6 | Texto legal e consentimento | Avisos de privacidade, base legal, responsáveis | **Humano / jurídico** (parecer necessário) |
| L7 | Retenção e exclusão | Nada se apaga; `desativado_em` | OK-auto; política de retenção: jurídico |

## 13. Infraestrutura e exposição
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| M1 | Portas | Só web em `127.0.0.1:18080` e API em `127.0.0.1:3000`; PostgreSQL sem porta; sem Redis | OK-ver |
| M2 | Túnel | Container por digest, somente leitura, sem capacidades, rede `siesal_web`, sem porta publicada | OK-ver |
| M3 | Porta 3000 pelo túnel | Sem resposta | OK-ver |
| M4 | Encerramento automático em 2 h | Tarefa agendada remove o container | Configurado; **confirmar às 18:14** |
| M5 | Isolamento do TI-REX | Nenhum container, rede, banco ou volume compartilhado | OK-ver |
| M6 | Segredos | Nada de `.env`, dump ou senha no git | **Humano**: conferir `git status` antes do commit |
| M7 | Caminhos sensíveis | `/.env`, `/metrics`, `/admin` | Sem conteúdo de serviço | OK-ver |
| M8 | Limite de login compartilhado atrás do túnel | 10 por minuto para todos | Limitação conhecida |

## 14. Resiliência e qualidade
| ID | Teste | Esperado | Situação |
|---|---|---|---|
| N1 | Reinício da API | Volta saudável; sessões válidas continuam | OK-ver (reinício feito; sessões não medidas) |
| N2 | Testes unitários e de integração | Todos passam | OK-auto (557 e 133) |
| N3 | Lint e tipos | Sem erros | OK-auto |
| N4 | Dependências | Versões exatas, sem `^` nem `~`; `pnpm audit` | **Não feito** (`pnpm audit`) |
| N5 | Imagens base | Digest fixo e atualizações | Túnel por digest; demais imagens: Não feito |
| N6 | Carga | 50 usuários simultâneos na caixa | Não feito |

## 15. Navegadores e dispositivos
Chrome, Firefox, Edge, Safari (iOS e macOS) e Chrome Android; telas de 360, 768 e 1280 px; tema claro, escuro e alto contraste. **Humano.** Só foram medidos, em navegador embutido, 360, 768 e 1280 px, nos perfis Aluno e Professor.

## 16. Pendências e riscos conhecidos (resumo)
1. **F-038 (aberta):** `Permissions-Policy` não chega na página inicial (regra do nginx). Correção de uma linha, não aplicada.
2. **F-036:** o commit d428548 (L15) ainda contém o vazamento do motivo da revisão. O L15 só vai para push ou merge junto com a correção do L16, ou depois dela.
3. Página "Avisos" do aluno: selo vermelho "Prazo passou" (contra a regra de tempo concreto).
4. Contorno de foco global com cerca de 2,9:1 (abaixo de 3:1).
5. Tela do Admin (TOTP) não conferida; checagem humana (leitor de tela, teclado, contraste, NAPNE) não feita.
6. Dados da auditoria semeados por script, sem eventos de criação na trilha.
7. O túnel temporário não tem login na frente, responde em HTTP e compartilha o limite de login entre todos os visitantes.
8. Sem parecer jurídico: nenhuma declaração de conformidade.

## 17. Ordem sugerida de execução para o auditor
1. Segurança de sessão e autorização (seções 1 a 3) com as contas de auditoria.
2. Fluxo do L16 e A-027 (seções 4 e 5).
3. Entrada de dados e injeção (seção 6), em modo exploratório.
4. Acessibilidade e linguagem (seções 10 e 11), com leitor de tela e teclado.
5. Privacidade e infraestrutura (seções 12 e 13).
6. Registro dos achados em `docs/REGISTRO-DE-FALHAS.md` (data, o que falhou, causa, correção, como voltar atrás).
