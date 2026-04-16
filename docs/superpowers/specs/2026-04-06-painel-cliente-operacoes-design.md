# Painel do Cliente — dentro de Operações

**Data:** 2026-04-06
**Status:** Aprovado

## Visão geral

Botão "Painel do Cliente" na tabela do ClientPortfolio (ao lado do "Salão de Guerra"). Ao clicar, abre página de detalhe do cliente com header fixo + timeline cronológica de tudo que aconteceu com aquele cliente.

## Header fixo

Card no topo com:
- Nome do cliente/loja
- Gestor atual (avatar + nome)
- CS atual (avatar + nome)
- Resultado (badge bom/médio/ruim — puxado do contrato)
- Data de entrada
- Link do Drive de criativos (botão que abre em nova aba)

## Timeline

Lista cronológica reversa (mais recente primeiro). Cada evento mostra:
- Ícone + cor por tipo
- Tipo do evento (badge)
- Conteúdo/descrição
- Data
- Quem registrou

### 9 tipos de evento

| Tipo | Ícone | Cor |
|---|---|---|
| Mudança de gestor | UserRoundPen | azul |
| Mudança de CS | UserRoundPen | roxo |
| Alinhamento | Handshake | verde |
| Resultado | TrendingUp | amarelo |
| Insatisfação | AlertCircle | vermelho |
| Conquista | Trophy | dourado |
| Erro do time | XCircle | vermelho escuro |
| Dificuldade externa | ShieldAlert | laranja |
| Nota geral | StickyNote | cinza |

## Permissões

- Qualquer membro do workspace pode adicionar eventos
- Só admin/owner pode deletar eventos

## Banco de dados

Uma única tabela `client_panel_timeline`:

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK → contracts | |
| workspace_id | uuid FK → workspaces | |
| event_type | enum | mudanca_gestor, mudanca_cs, alinhamento, resultado, insatisfacao, conquista, erro_time, dificuldade_externa, nota |
| content | text | descrição do evento |
| metadata | jsonb | dados extras (ex: previous_manager_id, new_manager_id) |
| occurred_at | date | quando aconteceu |
| created_by | uuid FK → auth.users | quem registrou |
| created_at | timestamptz | |

RLS: workspace_members (mesmo padrão do módulo de artes).

## Rota

`/dashboard/operations/client-panel/:contractId`

## Componentes

- `ClientPanelButton.tsx` — botão na tabela do ClientPortfolio
- `ClientPanelHeader.tsx` — header fixo com info do cliente
- `ClientPanelTimeline.tsx` — lista de eventos
- `ClientPanelEventForm.tsx` — dialog para adicionar novo evento
- `ClientPanelEventCard.tsx` — card individual de cada evento

## Hook

`useClientPanelTimeline.ts` — CRUD de eventos (React Query + Supabase)

## Padrões

- shadcn/ui, Tailwind, dark theme
- React Hook Form + Zod para formulários
- useWorkspace() para workspace_id e user
- Toast notifications via useToast()
