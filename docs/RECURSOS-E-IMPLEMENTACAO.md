# 🛠️ Recursos do SIESAL — Como Cada Um Foi Implementado

> Explicação técnica, recurso por recurso: **o que é, por que existe e como foi construído** (arquivos + técnicas + decisões de projeto). Complementa o README (visão geral) e os outros docs.

---

## 1. Tour Guiado (tutorial com seta apontando para os recursos)

**Arquivos:** `frontend/src/components/Tutorial/GuidedTutorial.tsx`; alvos marcados com `data-tutorial="..."` em Header, Sidebar, DashboardPage, DemandsPage, Agenda, Matérias e Settings.

### Como funciona
1. **Cada passo** da constante `STEPS` tem: título, descrição (com "Como usar"), a aba necessária (`tab`) e um **seletor CSS** (`selector`) de um elemento real da interface;
2. **Navegação automática:** ao trocar de passo, o componente chama `onNavigateTab(step.tab)` — o App troca de aba e o elemento alvo é renderizado;
3. **Spotlight (a "seta para o recurso"):** o elemento é medido com `getBoundingClientRect()` e um `div` posicionado exatamente sobre ele (com 6 px de folga) recebe:
   ```css
   box-shadow: 0 0 0 3px rgb(var(--c400)/0.45),   /* anel ciano ao redor */
              0 0 18px rgb(var(--c400)/0.25),       /* brilho */
              0 0 0 99999px rgba(2,6,23,0.82);       /* ← véu escuro que cobre TUDO, menos o alvo */
   ```
   O truque do `99999px` "fura" a tela deixando apenas o recurso visível — sem clip-path, sem canvas;
4. **Seta:** um losango (`div` 14×14 com `rotate(45deg)`) posicionado na borda do destaque conforme o lado (`top/bottom/left/right`) onde o cartão está;
5. **Medição resiliente:** `tryMeasure()` com **até 12 retentativas** (150 ms entre cada) até o elemento existir no DOM (a aba pode estar renderizando), `scrollIntoView({ block: 'center' })` para trazer o recurso à vista e um `setInterval` de 600 ms que **re-mede continuamente** (rolagem, resize e mudanças de layout mantêm o alvo no lugar);
6. **Posicionamento do cartão:** heurística — elementos da Sidebar (borda esquerda) recebem o cartão à direita; os demais preferem abaixo, depois acima; posições clamped ao viewport;
7. **Correção do bug "fora da tela" (v2):** a altura do cartão era **estimada** (270 px) e passos com textos longos estouravam o viewport. Agora um `useLayoutEffect` mede o **cartão real** via `ref` e o reposiciona para dentro da tela com margem de 12 px — correndo **antes da pintura**, sem "pulo" visível e convergindo sem loop (só re-renderiza se algo realmente mudou);
8. **Abre no primeiro login:** o App verifica a flag `@siesal:tutorial_concluido` no `localStorage`; se não existir, abre o tour ~1,2 s após o login (uma vez por navegador). Reaberto a qualquer momento pelo botão **Ajuda** da Sidebar;
9. **Acessibilidade:** teclas ←/→ navegam passos, `Esc` encerra; barra de progresso mostra "Passo X de 15".

---

## 2. Sistema de temas (6 cores de destaque)

**Arquivos:** `frontend/tailwind.config.js`, `frontend/src/index.css` (`:root`), `frontend/src/utils/appearance.ts`, bloco "Aparência" em `SettingsPage.tsx`.

### A técnica (CSS variables + Tailwind)
1. O `tailwind.config.js` **remapeia as paletas `cyan` e `sky`** para variáveis CSS com suporte a transparência:
   ```js
   cyan: { 400: 'rgb(var(--c400) / <alpha-value>)', ... }
   sky:  { 400: 'rgb(var(--s400) / <alpha-value>)', ... }
   ```
   Como toda a interface usa classes `cyan/sky` (botões, bordas, glows, gradients), **re-tematizar = trocar as variáveis**;
2. O `index.css` define os valores **padrão** (paleta Ciano do Tailwind em RGB `r g b`) no `:root`;
3. As classes do design system (`.siesal-button-primary`, `.siesal-card:hover`, `.glow-cyan`, scrollbar, fundo radial) foram reescritas usando `rgb(var(--c500) / 0.3)` etc. — tudo acompanha o tema;
4. **Geração dos temas** (`appearance.ts`): cada tema é um **matiz (hue) alvo**. Para cada uma das 11 tonalidades padrão, o código converte o hex original para HSL, **troca apenas o hue** (mantendo saturação/luminosidade — os tons escuros continuam escuros) e volta para RGB, sobrescrevendo `--cNNN`/`--sNNN` no `documentElement`:
   ```ts
   function shiftHue(hex, targetHue) {
     const [, s, l] = rgbToHsl(...hexToRgb(hex));
     const [r2, g2, b2] = hslToRgb(targetHue, s, l);
     return `${r2} ${g2} ${b2}`;
   }
   ```
   Resultado: 6 paletas coesas (Ciano, Azul, Violeta, Esmeralda, Âmbar, Rosa) geradas matematicamente;
5. **Sem flash de cor:** `loadAppearance()` roda no `main.tsx` **antes do primeiro render**, aplicando o tema salvo (`@siesal:accent`) instantaneamente;
6. **Cores semânticas ficam fixas:** os donuts de prioridade, cores de matérias e o logo do Google **não** mudam — são informação, não decoração (decisão de UX documentada no README).

### Extras do mesmo bloco
- **"Reduzir Animações"** adiciona a classe `siesal-reduced-motion` ao `<html>`; o CSS global zera durações de animação/transição. Também respeita `prefers-reduced-motion` do sistema operacional por padrão;
- **"Restaurar Padrões"** volta ao ciano (remove os overrides de uma só vez).

---

## 3. Notificações em tempo real + bipe real

**Arquivos:** `App.tsx` (polling + `applyNotifications`), `api.ts` (`pollNotifications`), `utils/appearance.ts` (som), `public/sounds/notification-beep.ogg`.

### Polling de 12 segundos
```ts
useEffect(() => {
  if (!isAuthenticated) return;
  const tick = async () => {
    const fresh = await api.pollNotifications();   // fetch puro
    if (fresh) applyNotifications(fresh);
  };
  const interval = setInterval(tick, 12000);
  return () => clearInterval(interval);
}, [isAuthenticated, applyNotifications]);
```

**Decisões de implementação:**
- `pollNotifications()` usa **`fetch` puro (não o `customFetch`)** e devolve `null` em falha — o fallback mock de localStorage **não roda** no polling, evitando bipes falsos quando o backend cai;
- `applyNotifications()` compara com `prevUnreadRef` e **só bipe/causa reação quando a contagem de não lidas AUMENTA** (marcar como lida nunca dispara); ao trocar de conta (logout), o baseline reinicia;
- Os **"Avisos do Sistema"** do Dashboard derivam da mesma lista (`dashboardStats = useMemo(() => ({...stats, avisos: notifications.slice(0,5)}))`) — painel e gaveta ficam sempre sincronizados sem refetch de stats;
- **Badge no título da aba:** `document.title = "(3) SIESAL..."` — funciona com a janela minimizada.

### O bipe real (baixado da internet)
- Arquivo **`beep_short.ogg`** da [Google Sound Library](https://actions.google.com/sounds) (licença **CC BY 4.0**, atribuição no README) salvo em `public/sounds/`;
- `playNotificationSound()` reaproveita uma instância de `Audio` (volume 0.5, `currentTime = 0` para "rebobinar");
- **Política de autoplay dos navegadores:** áudio só toca após uma interação — por isso `main.tsx` registra listeners **once** (`pointerdown`/`keydown`) que chamam `warmUpNotificationSound()` no primeiro gesto, carregando o arquivo e resolvendo o `AudioContext`;
- **Fallback sintetizado:** se o arquivo falhar ou o play() for bloqueado, um bipe de duas notas é gerado com Web Audio (oscilador `sine` 659→880 Hz com envelope exponencial) — o som nunca é perdido silenciosamente.

---

## 4. SiesalDialog — fim das janelas nativas

**Arquivo:** `frontend/src/components/UI/SiesalDialog.tsx` (+ `DialogProvider` no `main.tsx`).

### Motivação
`window.confirm/alert/prompt` são visualmente desconectados, bloqueiam a thread, não estilizam e quebram a experiência. Todas as ocorrências foram substituídas.

### Arquitetura (Context + Promises)
```tsx
const dialog = useDialog();

const ok = await dialog.confirm({ title, message, danger: true, confirmLabel: 'Excluir' });
if (!ok) return;

const digitado = await dialog.prompt({ title, message, typeThis: 'DELETAR' });  // digitação obrigatória
await dialog.alert({ title, message, icon: 'success' });
```
- O provider mantém **um diálogo ativo por vez** (`useState`) e resolve a Promise correspondente ao clicar (`true/false`, `string | null`, `void`);
- **`typeThis: 'DELETAR'`** desabilita o botão de confirmação até o usuário digitar o texto exato — usado na exclusão de conta (a antiga `prompt` nativa pedia o mesmo);
- **Ícones por tipo** (`info | warning | success | question`) + **modo `danger`** (botão vermelho) para ações destrutivas;
- **Teclado:** `Esc` cancela/fecha; `Enter` confirma prompts quando liberado;
- Mensagens aceitam **JSX** (negrito colorido, `<code>`, listas).

### Onde substituiu as janelas nativas
| Tela | Antes | Agora |
|---|---|---|
| Configurações → excluir conta | `confirm` + `prompt("DELETAR")` + `alert` ×2 | `confirm` + `prompt typeThis` + `alert` integrados |
| Configurações → limpar cache / backup | `confirm` + `alert` | diálogos com resumo do que foi exportado |
| Admin → purga / broadcast / ações de conta | `confirm` + `alert` | diálogos com resultado real da API |
| Excluir demanda / matéria | **sem confirmação** (v1) | confirmação integrada antes de excluir |

---

## 5. Edição de demandas (v2)

**Arquivos:** `DemandModal.tsx`, `DemandDetailPane.tsx`, `DemandsPage.tsx`, `App.tsx` (`openDemandModal`/`handleUpdateDemand`), `utils/date.ts` (`toLocalDateTimeInput`).

### Fluxo
1. O **Painel de Detalhes** ganhou um botão de lápis → `onEdit(demand)` → `App.openDemandModal(demand)` guarda a demanda em `editingDemand` e abre o modal;
2. O `DemandModal` recebe `editingDemand` + `onUpdate`; um `useEffect` **preenche** todos os campos quando abre (título, matéria, tipo, dificuldade, professor, descrição e **prazo formatado com `toLocalDateTimeInput()`** — `datetime-local` exige `YYYY-MM-DDTHH:mm` em fuso local, converter com `toISOString()` deslocaria o dia);
3. Em modo edição o cabeçalho vira "Editar Demanda", o botão "Salvar Alterações" e o **checkbox de lembrete desaparece** (o backend não recria lembretes na edição);
4. O submit chama `onUpdate(id, payload)` → `PUT /api/demands/:id` → o backend **recalcula a prioridade** com o novo prazo/dificuldade (o valor digitado nunca sobrepõe a regra);
5. Botões "Nova Demanda" (Header, Agenda, filtros) passam por `openDemandModal()` **sem argumento**, que zera `editingDemand` — nunca herda dados de uma edição anterior.

---

## 6. OfflineGate — tela "Servidor fora do ar"

**Arquivos:** `frontend/src/components/UI/OfflineGate.tsx`, uso no `App.tsx`; `api.pingBackend()` em `api.ts`.

### O problema
Sem o backend, nada do SIESAL funciona (login, dados, tour) — a v1 ficava num limbo de erros de console.

### Como funciona
1. **`api.pingBackend()`** — `GET /api/health` com **`AbortController` + timeout de 4 s** (health não consulta o MySQL por design — detecta queda do servidor, não do banco);
2. **`useBackendStatus(5000)`** — hook que faz ping imediato e depois a cada 5 s, com **tolerância a falhas**:
   ```ts
   failCountRef.current += 1;
   setStatus(prev => prev === 'checking' || failCountRef.current >= 2 ? 'offline' : prev);
   ```
   1 falha isolada (blip de rede) **não** derruba o sistema; 2 falhas seguidas = offline. Qualquer sucesso zera o contador;
3. **Estados do App:** `checking` → *splash* "Conectando ao servidor..." (primeira verificação); `offline` → a tela de bloqueio substitui **toda** a aplicação; `online` → app normal (o App permanece montado — estados React preservados durante a queda);
4. **Tela de bloqueio:** ilustração `ServerOff` com moldura tracejada animada, checklist de soluções (iniciar `npm run dev`, porta 3001, rede), botão **"Tentar novamente"** (chama `recheck` na hora) e aviso de reconexão automática a cada 5 s;
5. Os hooks do App continuam ativos por trás (polling de notificações devolve `null` silenciosamente) — quando o servidor volta, tudo se encaixa sozinho.

---

## 7. Modo de demonstração (fallback offline) — e por que ele não mente

**Arquivo:** `frontend/src/services/api.ts` (`customFetch` + `handleMockFallback`).

```ts
} catch (err: any) {
  if (err && err.isHttpError) throw err;      // erro HTTP real → SEMPRE sobe para a UI
  if (err instanceof TypeError)               // só FALHA DE REDE...
    return handleMockFallback<T>(endpoint, options, err);
  throw err;
}
```

- Na v1, **qualquer** erro — inclusive respostas 401/409 do servidor — caía no mock local, mascarando mensagens ("e-mail já cadastrado" virava outra coisa);
- Na v2, `!response.ok` marca o erro com `isHttpError` e ele **sempre** chega à interface; o fallback só entra quando o `fetch` rejeita com `TypeError` (rede/URL inalcançável);
- O mock mantém contas/demandas/materias/eventos/notificações em `localStorage` para demonstrações sem backend.

---

## 8. Matérias: cor personalizada + edição + progresso

**Arquivos:** `SubjectModal.tsx`, `SubjectsPage.tsx`, `App.tsx` (`handleUpdateSubject`).

- **Color picker nativo:** `<input type="color">` ao lado da paleta rápida — o valor vai direto para `cor` (qualquer hex). A pré-visualização usa `/^#[0-9a-fA-F]{6}$/` para garantir que o input recebe um hex válido (o `type="color"` exige);
- **Modo edição:** lápis em cada linha preenche o formulário (`editingId`) e o submit vira `PUT /subjects/:id` ({ nome?, cor? }); "Cancelar edição" restaura o modo criação; ao reabrir o modal, um `useEffect` reseta tudo;
- **Barra de progresso:** `progressPct = concluídas/total` por matéria, com gradiente esmeralda→teal e `Math.max(pct, 2)` para o mínimo visível;
- **Badge "Atrasada":** derivada no card (`data_entrega < agora && status !== 'Concluido'`), vermelha e pulsante; no Painel de Detalhes o campo Status mostra *Concluído / Atrasada / No prazo*.

---

## 9. Painel do Administrador V2

**Arquivos:** `backend/src/controllers/adminController.ts`, `adminRoutes.ts`; UI em `AdminPage.tsx`.

- **Métricas em tempo real:** `GET /admin/stats` faz `SELECT 1` (latência) + contagens em paralelo, incluindo `demandsOverdue` (Prisma: `data_entrega < now() AND status != 'Concluido'`), `activeUsers` e `newSignups7d` — o painel atualiza a cada 10 s;
- **Gestão de contas:** `Power` alterna `status` (conta desativada recebe 403 no login), `LockOpen` desbloqueia NF03, lixeira exclui com cascade (LGPD). Guardas no backend: **não pode desativar/excluir a própria conta**, **não pode excluir outro admin**, e a própria conta aparece como "(você)" na tabela;
- **Broadcast:** `createMany` cria uma notificação por usuário — os alunos ouvem o bipe em ≤12 s (polling de tempo real);
- **Todas as ações usam o SiesalDialog** (confirm + resultado real da API).

---

## 10. Verificação de senha contra vazamentos (resumo técnico)

Detalhe completo (SHA-1 + prefixo de 5 chars + comparação local de sufixo + graceful degradation) em **`docs/AUTENTICACAO-E-SEGURANCA.md` §3**. Implementação: `frontend/src/utils/security.ts` (`checkPasswordBreach`), usada em cadastro (`AuthPage`) e troca de senha (`SettingsPage`).

---

## 11. Utilidades que sustentam tudo

| Utilidade | Arquivo | O que resolve |
|---|---|---|
| Prioridade dinâmica | `utils/priorityCalculator.ts` (frontend + backend) | Mesma regra nos dois lados — a UI mostra exatamente o que o backend calculará |
| Datas em fuso local | `utils/date.ts` | `toLocalDateString`, `isoToLocalDateString`, `toLocalDateTimeInput` — fim dos bugs de eventos "pulando" de dia por conversão UTC |
| Temas + som + prefs | `utils/appearance.ts` | Motor HSL do §2, `getPref/setPref` (localStorage) e o bipe |
| `getAuthHeader` + endpoints | `services/api.ts` | Token injetado em toda chamada; ~35 métodos tipados |

---

## 12. Guia rápido de execução do projeto

```bash
# 1. Instalar tudo (raiz instala backend + frontend)
npm run install:all

# 2. Configurar backend/.env (DATABASE_URL, JWT_SECRET, GOOGLE_*)
#    → guia completo no README.md e em docs/AUTENTICACAO-E-SEGURANCA.md §4.1

# 3. Sincronizar o banco (não apaga dados)
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:db:push
npm --prefix backend run prisma:seed        # conta demo: jose.arimateia@escola.gov.br / 123456

# 4. Rodar (backend 3001 + frontend 5173)
npm run dev

# Admin (opcional)
npm --prefix backend run console            # grant-admin email@escola.gov.br
```
