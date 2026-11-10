# Endereço fixo (Tailscale Funnel) e página de manutenção (L16c)

Endereço fixo: **https://siesal.tail378cb5.ts.net** (era `ntb-w1lopes`; renomeado em 09/11/2026, ver F-042). O nome já está confirmado no Tailscale deste computador (MagicDNS ligado, capacidade `https` presente).

## Como fica o caminho
Internet → Tailscale Funnel (porta 443 do endereço fixo) → `127.0.0.1:18081` (container `proxy`) → `web` (nginx do site) → `api`.
O proxy é o único ponto que o Funnel enxerga. PostgreSQL e API continuam sem porta pública. O link da Cloudflare não foi alterado e continua apontando direto ao site (`web:8080`), até 23:00 de 08/11/2026.

## Ligar o Funnel (você faz uma vez; o comando é exato)
Terminal do Windows (PowerShell), porta **18081**:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg 18081
```

Conferir:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' funnel status
```

Desligar o Funnel:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' funnel reset
```

Observações:
- `--bg` deixa a configuração gravada: o Funnel volta sozinho quando o Tailscale reinicia.
- O Funnel só aceita as portas externas 443, 8443 e 10000. Aqui usa a 443 (padrão), então o endereço não leva número de porta.
- **Pode ser que o comando peça para habilitar o Funnel no painel do Tailscale.** A lista de capacidades deste computador não mostra a de Funnel. Se isso acontecer, o próprio comando imprime um link; abra, aprove e rode de novo. Isso só você pode fazer (é a sua conta).
- Eu não liguei o Funnel: você pediu os comandos, e ligar publica o sistema na internet.

## Página de manutenção
Fora da janela diária, o proxy responde **só** a página "Sistema em construção. Entre em contato com o desenvolvedor." (HTTP 503), para qualquer caminho e método (inclusive `/api`). Nada é repassado ao site nem à API: sem dado escolar, sem credencial, sem cookie.

**Janela automática (padrão): aberto das 06:00 às 23:59, horário de America/Sao_Paulo; das 00:00 às 05:59 fica em manutenção.** O fuso vem do banco de fusos do container, não de um número fixo no código.

Variáveis no `.env` (fora do código; não são segredo):

| Variável | Valor | Efeito |
|---|---|---|
| `MANUTENCAO_JANELA` | `06:00-23:59` (padrão) | Horário em que o sistema fica aberto. Vale também janela que passa da meia-noite (`22:00-06:00`). Vazio = sem janela |
| `MANUTENCAO_MODO` | `auto` (padrão) | Segue a janela |
| | `ligada` | Manutenção agora, ignorando a janela |
| | `liberada` | Aberto agora, ignorando a janela |

Comandos manuais (terminal WSL, um por vez; alteram só `MANUTENCAO_MODO` no `.env` e refazem o container `proxy`):

```bash
bash scripts/manutencao.sh ligar
```

```bash
bash scripts/manutencao.sh liberar
```

```bash
bash scripts/manutencao.sh automatico
```

```bash
bash scripts/manutencao.sh estado
```

Se mudar a janela no `.env`, refaça o proxy: `docker compose up -d proxy`. O proxy confere o horário a cada 15 segundos, sem reiniciar.
O acesso local direto (`http://localhost:18080`) e o link da Cloudflare não passam pelo proxy e não entram em manutenção.

## Se o computador dormir
- Dormindo, o Windows pausa o Docker, o Tailscale e a rede. **Nada responde**: o endereço fixo fica fora do ar (erro de conexão do navegador), e **não** aparece a página "em construção". A página só aparece se o computador estiver ligado.
- Ao acordar, o Tailscale reconecta e o Funnel volta (`--bg`). O proxy confere o horário na primeira checagem (até 15 segundos) e entra ou sai da manutenção conforme a janela.
- O link da Cloudflare não volta depois de dormir de forma garantida; o encerramento agendado das 23:00 usa `StartWhenAvailable` (roda ao acordar se perdeu o horário).
- Para evitar sono durante a auditoria: Configurações do Windows → Sistema → Energia → "Suspender: nunca" na tomada. Não alterei essa configuração.

## Limites conhecidos
- Atrás do Funnel (como no túnel), os visitantes aparecem com o mesmo endereço no limite de tentativas de login (10 por minuto no total). O sistema não confia em `X-Forwarded-For` enviado pelo cliente.
- O Funnel é público: qualquer pessoa com o endereço chega à tela de login. Proteções: bloqueio da conta por 15 minutos após 5 falhas.

## Testes feitos (08/11/2026, container `proxy` real)
- Normal: `/` 200, `/api/config` 200, `/api/caixa` sem sessão 401.
- Manutenção: GET, POST, PUT, DELETE e HEAD respondem 503 com a página; `/manutencao.css` e `/proxy-saude` respondem 200; `/_manutencao.html` direto dá 404.
- Janela: `03:00-04:00` (fora) = 503; `22:00-06:00` (dentro, passa da meia-noite) = 200; sem janela = 200; modo `ligada` = 503; modo `liberada` = aberto mesmo fora da janela.
- Bordas da janela padrão (hora simulada): 00:00 e 05:59 manutenção; 06:00, 12:30 e 23:59 aberto.
- Cabeçalhos da página de manutenção: `Cache-Control: no-store`, `Retry-After: 3600`, CSP restritiva.
