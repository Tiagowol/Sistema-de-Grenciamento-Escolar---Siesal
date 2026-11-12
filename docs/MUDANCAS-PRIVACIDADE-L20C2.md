# Mudanças de privacidade exigidas pelo 20c-2

Para aplicar no Projeto "TW1-SaaS-SIESAL" (RIPD, Política de Privacidade, Mapa de Riscos). O Code não lê nem altera esses documentos. Obrigatório **antes de qualquer dado real**, não antes do código de teste. Redação em "projetado para atender"; só vale "em conformidade" depois de parecer jurídico.

## A. RIPD
1. **Dados coletados (novos):** data de nascimento do aluno; CPF do aluno (opcional se ≥18, a decidir se é exigido para menor); matrícula (opcional); escola(s) em texto (opcional); do responsável de menor: nome, CPF, data de nascimento e e-mail.
2. **Remover** a frase "o sistema não coleta CPF" e qualquer equivalente.
3. **Finalidade e base legal:** idade e autorização do responsável (ECA Digital, Lei 15.211/2025; LGPD art. 14, tratamento de dados de criança e adolescente); identificação do responsável. Base legal por dado: a confirmar no parecer jurídico.
4. **Minimização:** CPF do maior de 18 é opcional (D2b); não há foto de documento (D7); não há prova de que o CPF pertence ao responsável, só a conferência dos dígitos (limite a declarar).
5. **Medidas técnicas:** CPF cifrado (AES-256-GCM, chave separada, fora do git); índice por HMAC; exibição mascarada; fora de log, resposta de API e auditoria; RLS por instituição.
6. **Retenção e eliminação:** pedido do responsável não confirmado expira em 7 dias e os dados do pedido são apagados. Prazo de guarda do CPF e da data de nascimento de contas ativas e encerradas: a definir.
7. **Prova da autorização:** versão do termo, data e hora e identificador do pedido, sem CPF.
8. **Direitos do titular:** como o responsável corrige, acessa ou revoga a autorização; como o CPF é alterado (gera auditoria "CPF alterado", sem o valor).
9. **Compartilhamento:** nenhum. O Master vê só quantidades. Na Parte 1 o e-mail vai para caixa de teste local; o envio real (operador de e-mail) entra na Parte 2 e exige nova atualização.

## B. Política de Privacidade
1. Linguagem simples e literal, em seção própria para o aluno e outra para o responsável.
2. Listar cada dado novo, para que serve e por quanto tempo fica.
3. Explicar que menor de 18 anos precisa da autorização do responsável e que, sem ela, a conta não guarda dado escolar.
4. Dizer que o CPF aparece mascarado e que o Master não o vê.
5. Dizer que o sistema confere só os dígitos do CPF do responsável.
6. Texto das 3 caixas do termo do responsável (precisa ser idêntico ao do sistema; a versão do termo vai com a prova):
   - "Sou o responsável legal por [nome]."
   - "Autorizo o uso do SIESAL por ele e o tratamento dos dados descritos na Política de Privacidade."
   - "Declaro que os dados informados são verdadeiros."
7. Contato do encarregado (DPO) e como exercer os direitos.

## C. Mapa de Riscos (linhas novas)
| Risco | Mitigação prevista | Risco residual |
| --- | --- | --- |
| Vazamento de CPF | Cifra, chave separada, máscara, fora de log e auditoria, RLS | Perda ou roubo da chave: cópia segura da chave e rotação |
| Perda da chave do CPF | Cópia segura, fora do git | CPFs ilegíveis se a cópia também for perdida |
| CPF de responsável falso ou de terceiro | Só confere dígitos; CPFs diferentes; maior de 18 | Não há prova de titularidade (vai ao parecer jurídico) |
| Menor cria conta sem responsável | Conta fica "aguardando"; sem dado escolar; pedido expira em 7 dias | Responsável falso |
| Link do responsável interceptado ou reutilizado | Uso único, 7 dias, guardado só como hash | E-mail comprometido |
| Dados do pedido expirado ficam guardados | Apagamento no vencimento | Falha do job de limpeza (teste cobre) |
| Enumeração de e-mail ou CPF | Resposta igual para qualquer recusa; limitador | Baixo |
| Dado real usado em teste | Só dados fictícios; parecer jurídico antes de dado real | Erro humano |
| Caixa de teste mostra e-mails com dado | Só local (127.0.0.1), só fictícios | Exposição se a porta for aberta |

Atualizar também a matriz CIDA do 20c-2 já prevista em `docs/PLANO-L20C.md` (seção 5).
