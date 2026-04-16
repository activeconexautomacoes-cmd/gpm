# Checklist CRM — Design Spec

**Data:** 2026-04-15
**Status:** Aprovado
**Módulos afetados:** Configurações, CRM (Kanban), Tasks (Operações)

---

## Resumo

Sistema de checklist para oportunidades do CRM com:
- Templates configuráveis em Configurações (nova aba "Checklist")
- Criação automática de tasks ao mudar de estágio (gatilho)
- Responsável padrão definido no template, editável manualmente
- Prazo + SLA com alertas visuais
- Progresso visível no card do Kanban ("3/9" com cores)
- Tasks gerenciadas no módulo Tasks existente

---

## 1. Modelo de Dados

### 1.1 Nova tabela: `checklist_templates`

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID PK | default gen_random_uuid() |
| workspace_id | UUID FK → workspaces | Multi-tenant, NOT NULL |
| stage_id | UUID FK → opportunity_stages | Estágio que dispara a criação, NOT NULL |
| name | TEXT NOT NULL | Nome do template (ex: "Checklist Negociação") |
| is_active | BOOLEAN DEFAULT true | Ativa/desativa sem deletar |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

**RLS:** workspace_id = current workspace (mesmo padrão das demais tabelas).

### 1.2 Nova tabela: `checklist_template_items`

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID PK | default gen_random_uuid() |
| template_id | UUID FK → checklist_templates ON DELETE CASCADE | NOT NULL |
| title | TEXT NOT NULL | Nome da tarefa |
| description | TEXT | Detalhes opcionais |
| order_position | INTEGER NOT NULL | Ordem de exibição |
| default_assignee_role | TEXT NOT NULL CHECK IN ('sdr','closer','custom') | Papel padrão |
| default_assignee_id | UUID FK → profiles, nullable | Pessoa fixa (quando role = 'custom') |
| deadline_hours | INTEGER NOT NULL | Prazo em horas após criação |
| sla_hours | INTEGER NOT NULL | SLA máximo em horas |
| is_required | BOOLEAN DEFAULT true | Obrigatório para considerar checklist completa |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### 1.3 Alterações na tabela `tasks`

Novos campos adicionados:

| Campo | Tipo | Descrição |
|---|---|---|
| opportunity_id | UUID FK → opportunities, nullable | Vincula task à oportunidade |
| template_item_id | UUID FK → checklist_template_items, nullable | Rastreabilidade do template de origem |
| deadline_at | TIMESTAMPTZ, nullable | Prazo calculado (now + deadline_hours) |
| sla_deadline_at | TIMESTAMPTZ, nullable | SLA calculado (now + sla_hours) |
| sla_status | TEXT CHECK IN ('on_time','warning','overdue') DEFAULT 'on_time' | Status do SLA |
| completed_at | TIMESTAMPTZ, nullable | Timestamp de conclusão |

**Index:** `idx_tasks_opportunity_id` em `opportunity_id` para queries de contagem.

### 1.4 Alterações na tabela `opportunities` (cache de progresso)

| Campo | Tipo | Descrição |
|---|---|---|
| checklist_total | INTEGER DEFAULT 0 | Total de itens da checklist |
| checklist_done | INTEGER DEFAULT 0 | Itens concluídos |
| checklist_sla_status | TEXT CHECK IN ('on_time','warning','overdue') DEFAULT 'on_time' | Pior status entre os itens pendentes |

Esses campos são cache desnormalizado para evitar JOINs no Kanban. Atualizados via triggers.

---

## 2. Gatilhos (Triggers / Functions)

### 2.1 Trigger: Criação automática de tasks ao mudar estágio

**Evento:** UPDATE em `opportunities` quando `current_stage_id` muda (OLD.current_stage_id != NEW.current_stage_id)

**Lógica da function `fn_create_checklist_tasks()`:**

1. Busca `checklist_templates` ativo para o novo `stage_id` e `workspace_id`
2. Se não encontrar template, retorna sem ação
3. Verifica se existem tasks pendentes (status != 'done') vinculadas à oportunidade de templates anteriores
   - Se existirem: **não cria as novas tasks automaticamente** — seta flag `has_pending_previous_tasks = true` no retorno (tratado pelo frontend via modal)
4. Se não houver pendentes (ou após confirmação do frontend):
   - Para cada item do template:
     - Cria `task` com:
       - `workspace_id` = oportunidade.workspace_id
       - `opportunity_id` = oportunidade.id
       - `template_item_id` = item.id
       - `title` = item.title
       - `description` = item.description
       - `status` = 'todo'
       - `type` = 'checklist'
       - `priority` = 'medium'
       - `assignee_id` = resolução do responsável (ver 2.2)
       - `deadline_at` = NOW() + item.deadline_hours * interval '1 hour'
       - `sla_deadline_at` = NOW() + item.sla_hours * interval '1 hour'
       - `sla_status` = 'on_time'
   - Atualiza `opportunities`:
     - `checklist_total` = contagem de itens criados
     - `checklist_done` = 0
     - `checklist_sla_status` = 'on_time'

**Nota sobre o modal:** Como triggers no banco não podem "pausar" para input do usuário, a lógica de verificação de tasks pendentes será feita no frontend antes de confirmar a mudança de estágio. O frontend chama uma RPC para verificar e, se necessário, exibe o modal. Após a escolha do usuário, chama outra RPC para executar a ação (cancelar pendentes ou manter) e então atualiza o estágio.

### 2.2 Resolução de responsável

```
SE default_assignee_role = 'sdr' → opportunities.assigned_sdr
SE default_assignee_role = 'closer' → opportunities.assigned_closer
SE default_assignee_role = 'custom' → checklist_template_items.default_assignee_id
```

Se o valor resolvido for NULL (ex: oportunidade sem SDR atribuído), o campo `assignee_id` da task fica NULL (sem responsável — pode ser atribuído manualmente depois).

### 2.3 Trigger: Atualização do progresso ao completar task

**Evento:** UPDATE em `tasks` quando `status` muda para 'done' E `opportunity_id` IS NOT NULL

**Lógica da function `fn_update_checklist_progress()`:**

1. Seta `completed_at = NOW()` na task
2. Conta tasks com `opportunity_id` = X: total e done
3. Calcula pior `sla_status` entre tasks pendentes (não done)
4. Atualiza `opportunities`:
   - `checklist_done` = contagem de done
   - `checklist_sla_status` = pior status pendente (ou 'on_time' se todas completas)

### 2.4 Cálculo de SLA status

Executado via Supabase Edge Function em cron (a cada 15 minutos) ou via cálculo no momento de leitura:

```
SE NOW() < sla_deadline_at - (sla_hours * 0.25 * interval '1 hour') → 'on_time'
SE NOW() >= sla_deadline_at - (sla_hours * 0.25 * interval '1 hour') AND NOW() < sla_deadline_at → 'warning'
SE NOW() >= sla_deadline_at → 'overdue'
```

Após recalcular `sla_status` das tasks, atualiza `checklist_sla_status` na oportunidade.

---

## 3. RPCs (Supabase Functions)

### 3.1 `rpc_check_pending_checklist_tasks(opportunity_id UUID)`

Retorna: `{ has_pending: boolean, pending_count: integer }`

Usado pelo frontend antes de mudar estágio para decidir se mostra modal.

### 3.2 `rpc_handle_stage_change_checklist(opportunity_id UUID, action TEXT)`

- `action = 'cancel_pending'` → marca tasks pendentes como cancelled, cria novas
- `action = 'keep_all'` → mantém as existentes, cria novas

### 3.3 `rpc_create_checklist_tasks(opportunity_id UUID, stage_id UUID)`

Cria tasks a partir do template do estágio. Chamada pelas RPCs acima e pode ser chamada manualmente.

---

## 4. Interface — Configurações (Nova aba "Checklist")

### 4.1 Localização

Nova aba em `WorkspaceSettings.tsx`, ao lado de "Pipeline CRM", "Squads", "Integrações & IA".

Permissão necessária: `pipeline.config` (mesma do Pipeline CRM).

### 4.2 Tela principal

- Lista de estágios do pipeline (reutiliza dados de `opportunity_stages`)
- Cada estágio mostra:
  - Nome do estágio com cor
  - Template vinculado (se existir) com contagem de itens
  - Se não tiver template: botão "Criar Template"
  - Se tiver: botão "Editar" e toggle ativo/inativo
- Um estágio pode ter no máximo 1 template ativo

### 4.3 Dialog de criação/edição de template

**Campos do template:**
- Nome (TEXT, obrigatório)
- Estágio vinculado (select, pré-preenchido se criado a partir de um estágio)

**Lista de itens (drag-and-drop via dnd-kit para reordenar):**

Cada item mostra:
- Título (TEXT, obrigatório)
- Descrição (TEXT, colapsável, opcional)
- Responsável padrão: select com opções:
  - "SDR da oportunidade"
  - "Closer da oportunidade"
  - Lista de membros do workspace (role = 'custom')
- Prazo: input numérico + select "horas" / "dias" (convertido para horas ao salvar)
- SLA: input numérico + select "horas" / "dias"
- Toggle "Obrigatório"
- Botão de remover item

**Ações:**
- "Adicionar item" no final da lista
- "Salvar" — valida e persiste
- "Cancelar" — descarta alterações

### 4.4 Componentes novos

- `ChecklistSettings.tsx` — Tela principal da aba
- `ChecklistTemplateDialog.tsx` — Dialog de criação/edição
- `ChecklistTemplateItemRow.tsx` — Linha de item no dialog (drag-and-drop)

---

## 5. Interface — Card do Kanban (OpportunityCard)

### 5.1 Indicador de checklist

Exibido quando `checklist_total > 0`.

**Layout:**
- Ícone `CheckSquare` (lucide-react) + texto "3/9"
- Posicionado junto aos indicadores existentes (follow-up, lead score, etc.)

**Cores do texto e ícone:**
- `checklist_sla_status = 'on_time'` → `text-green-600`
- `checklist_sla_status = 'warning'` → `text-yellow-600`
- `checklist_sla_status = 'overdue'` → `text-red-600`

### 5.2 Dados

Campos `checklist_total`, `checklist_done`, `checklist_sla_status` já vêm na query de oportunidades (cache desnormalizado), sem necessidade de JOIN adicional.

---

## 6. Interface — Módulo Tasks

### 6.1 Novo filtro: Oportunidade

- Adicionado aos filtros existentes do TasksBoard
- Select com busca (combobox) que lista oportunidades do workspace
- Filtra tasks onde `opportunity_id` = selecionado

### 6.2 Badge de oportunidade nas tasks

- Tasks com `opportunity_id` preenchido mostram badge com nome do lead
- Clicável: abre o OpportunityDialog da oportunidade vinculada

### 6.3 Novo tipo de task

Adicionar `'checklist'` ao enum de tipos em `operations.ts`:
```typescript
type: 'traffic' | 'design' | 'copy' | 'strategy' | 'checklist' | 'other'
```

### 6.4 Indicadores de prazo/SLA

- Tasks de checklist mostram `deadline_at` e `sla_deadline_at`
- Indicador visual de SLA (mesmas cores do card: verde/amarelo/vermelho)

---

## 7. Modal de confirmação ao mudar estágio

### 7.1 Quando aparece

Quando o usuário arrasta um card para outro estágio (ou muda via dialog) E existem tasks pendentes do estágio anterior (`rpc_check_pending_checklist_tasks` retorna `has_pending = true`).

### 7.2 Conteúdo

> **Tarefas pendentes encontradas**
>
> Existem X tarefas pendentes da checklist do estágio anterior. O que deseja fazer?
>
> - [Cancelar pendentes] — Marca como canceladas e cria novas tarefas
> - [Manter todas] — Mantém as anteriores e adiciona as novas

### 7.3 Componente

- `ChecklistStageChangeDialog.tsx` em `/src/components/crm/`

---

## 8. Permissões

- Configuração de templates: `pipeline.config` (já existe)
- Visualização de tasks no módulo Tasks: `ops.view` (já existe)
- Edição de tasks: permissões existentes do módulo Tasks

Não são necessárias novas permissões.

---

## 9. Migrations necessárias

1. Criar tabelas `checklist_templates` e `checklist_template_items`
2. Alterar tabela `tasks`: adicionar campos `opportunity_id`, `template_item_id`, `deadline_at`, `sla_deadline_at`, `sla_status`, `completed_at`
3. Alterar tabela `opportunities`: adicionar campos `checklist_total`, `checklist_done`, `checklist_sla_status`
4. Criar index `idx_tasks_opportunity_id`
5. Criar functions e triggers (`fn_update_checklist_progress`)
6. Criar RPCs (`rpc_check_pending_checklist_tasks`, `rpc_handle_stage_change_checklist`, `rpc_create_checklist_tasks`)
7. Criar Edge Function para cron de SLA (a cada 15 min)
8. Adicionar `'checklist'` ao enum/check de tipo de task
9. RLS policies para novas tabelas
