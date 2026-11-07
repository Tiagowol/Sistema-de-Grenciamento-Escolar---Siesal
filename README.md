# SIESAL 4.0

Sistema Inteligente de Estudos, Agenda e Aprendizagem: sistema escolar inclusivo e multi-instituição, feito como TCC (IFRN Canguaretama) e simulado como SaaS.

Estado: Lote 1 concluído em 07/11/2026 (base do repositório e esqueleto Docker com /saude, verificado no PC do autor). Ainda não há funcionalidades.

## O que este projeto não é
- Não é ferramenta clínica: sem diagnóstico, sem ranking e sem comparação entre alunos.
- Não é serviço em produção. Só dados fictícios. A única conta real é a do autor do TCC (maior de 18 anos).

## Tecnologia (ADR-007, 07/11/2026)
TypeScript, Node 26 LTS, Fastify 5.12.8, React 19.3.1 + Vite 8.3.6, PostgreSQL 18.6 com RLS, Prisma 7.10.1, Better Auth 1.7.18, pg-boss 12.38.1, Docker Compose próprio.

## Regras do repositório
- Repositório público: nenhum segredo, IP, domínio interno, dado real ou dump.
- Variáveis de ambiente: copiar `.env.example` para `.env` (o `.env` nunca vai para o git).
- Versões exatas, sem `^` nem `~`. Atualização só em lote aprovado.
- Migrações só pelo job `migrate`, com backup antes.
- Falhas corrigidas ficam em `docs/REGISTRO-DE-FALHAS.md`.

## Documentos
A documentação de planejamento (Visão, ADRs, matriz de permissões, modelo de dados, riscos, privacidade) está no projeto de trabalho e será copiada para `docs/` em lote próprio.

## Conformidade
Projetado para atender LGPD, ECA Digital (Lei 15.211/2025), WCAG 2.2 AA e eMAG. Sem parecer jurídico até o momento; não afirmamos "em conformidade".
