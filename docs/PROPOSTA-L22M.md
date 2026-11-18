# PROPOSTA L22m — Teste de carga (100, 500 e 1000 alunos, 10 instituições) — 18/11/2026

Estado: **Planejado (proposta escrita). Nenhum código, instalação nem execução feitos.** Origem: pedido do autor de 18/11/2026 ("quero sim", depois do push e do L22l). Responde ao teste N6 ("Carga"), que nunca foi feito.

## Objetivo
Trocar a **estimativa** de hospedagem (tabela da conversa de 18/11) por **números medidos**: memória, processador, tempo de resposta e erros do SIESAL com 100, 500 e 1000 alunos em 10 instituições.

## Estado anterior (fato)
- Consumo medido parado, em 18/11: cerca de 175 MB (banco 76, API 62, proxy 8, site 8, caixa de teste 21).
- Limites no `compose.yaml`: banco 768 MB / 1,0 núcleo; API 256 MB / 0,5; site 128 MB / 0,25; proxy 64 MB / 0,25.
- O login tem limite de 10 tentativas por minuto por endereço (proteção contra força bruta).
- Nunca houve teste de carga.

## Itens do lote (3)
1. **Ambiente de carga separado.** Um projeto Docker Compose próprio (`siesal-carga`), com banco, rede e volume **próprios**, criado só para o teste e apagado no fim. Não usa o banco do site, nem nada do TI-REX. Mesmos limites de memória e processador do `compose.yaml`, para o resultado valer para um servidor do mesmo tamanho. Só neste ambiente, o limite de login por minuto fica alto (senão o teste mede a proteção, não o sistema).
2. **Dados fictícios e roteiros.**
   - Script que cria 10 instituições com 100, 500 e depois 1000 alunos no total, mais professores, pedagógico e responsáveis na mesma proporção. Também cria turmas, atividades, notas e avisos. Nomes e e-mails visivelmente fictícios (`@exemplo.invalid`).
   - Roteiros na ferramenta **k6** (imagem Docker oficial, versão exata). Aluno: entrar, Meu dia, Atividades, Agenda, sino. Professor: entrar, Notas da turma, sino. Admin: entrar, Usuários. Pausas de leitura entre as telas, como uma pessoa real.
3. **Execução e relatório.**
   - Três rodadas (100, 500, 1000 alunos), com 10 a 15% de uso simultâneo, mais uma rodada de pico (o dobro), cada uma por 10 minutos.
   - Mede: tempo de resposta (mediana e p95: 95% das respostas abaixo dele), taxa de erro, memória e processador de cada serviço (pico e média) e tamanho do banco.
   - Entrega `docs/RESULTADO-CARGA-L22M.md`: a tabela de hospedagem refeita com números medidos e o tamanho de servidor recomendado para cada cenário.

## Critérios de "terminou"
1. As 4 rodadas executadas, com os números no relatório.
2. Taxa de erro abaixo de 1% e p95 abaixo de 500 ms no cenário de 1000 alunos. Se não passar, o relatório diz onde travou; a correção vira outro lote.
3. Ambiente de carga apagado no fim (containers, rede, volume). O site e o banco do autor não mudam.
4. Scripts do teste no git (pasta `verificacao/carga/`), sem senha nem dado real.

## Fora do lote
- Otimizar o sistema (se o teste mostrar problema, vira outro lote).
- Teste no túnel ou no link externo (mediria a internet, não o SIESAL).
- Contratar servidor.

## Riscos
- **O notebook não é um servidor.** Mesmo com os limites iguais, o disco e o processador do notebook são diferentes. O relatório separa o que foi medido do que é projeção.
- **Instalação:** baixa a imagem do k6 do Docker Hub (versão exata, como as outras imagens). Nada é instalado fora do Docker.
- **O computador fica pesado** durante as rodadas (cerca de 1 hora no total).

## Pergunta
- **Q1. Onde rodar?**
  - **(Recomendado) No notebook, com os limites do `compose.yaml`.** Sem custo; o relatório deixa claro que é projeção para um servidor do mesmo tamanho.
  - Em um servidor alugado por algumas horas (2 núcleos, 4 GB). Número mais fiel, mas tem custo e precisa de conta e de pagamento feitos por você.

## Feito, Falta e Sugestões
- **Feito:** esta proposta.
- **Falta:** aprovação e resposta à Q1.
- **Sugestões:** rodar depois da conferência humana do L22j e do L22k, para não misturar testes.
