# Modulo de Solicitacao de Artes — Design Spec

## Visao Geral

Modulo integrado ao GPM Nexus para solicitacao de artes promocionais em agencias de marketing digital. Gestores solicitam artes informando URL do site, formatos e oferta. Uma IA (Claude API via Edge Function) analisa o site, extrai identidade visual e gera um brief detalhado para o designer executar sem tomar decisoes criativas. Admins controlam permissoes, formatos e metricas.

## Decisoes de Design

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Integracao | Modulo dentro do GPM Nexus | Reaproveita auth, layout, sidebar, Supabase client |
| Roles | RBAC existente com novas permissoes | Flexivel, sem alterar banco, segue padrao |
| Tema | Design system existente do GPM | Consistencia visual |
| Kanban | Componentes proprios com @dnd-kit | Independente do CRM, mesma lib ja instalada |
| Estrutura | Monolitico (pages/artes + components/artes) | Segue padrao do projeto (ex: financial/) |
| Edge Function | Completa com Claude API | Funcional de ponta a ponta |
| Usuarios | Atribuir permissoes a membros existentes | Sem duplicar criacao de usuarios |
| Rotas | Rota unica adaptativa /dashboard/artes | Simples, menos rotas, adapta por permissao |
| Kanban visibilidade | Todos os perfis veem o kanban | Admin ve todos, gestor ve os que criou, designer ve os atribuidos |

## Banco de Dados

### Enums

```sql
CREATE TYPE art_priority AS ENUM ('normal', 'urgente');
CREATE TYPE art_status AS ENUM ('solicitada', 'realizando', 'ajustando', 'aprovacao', 'concluida');
```

### Tabelas

**art_formats** — Formatos de arte disponiveis
- `id` uuid PK default gen_random_uuid()
- `workspace_id` uuid FK workspaces NOT NULL
- `name` text NOT NULL
- `width` int NOT NULL
- `height` int NOT NULL
- `active` boolean DEFAULT true
- `created_by` uuid FK profiles
- `created_at` timestamptz DEFAULT now()

Dados iniciais: Feed 1080x1080, Story 1080x1920, Banner 1200x628, Capa Facebook 820x312, Post Carrossel 1080x1350, Thumbnail YouTube 1280x720.

**art_requests** — Solicitacoes de arte
- `id` uuid PK default gen_random_uuid()
- `workspace_id` uuid FK workspaces NOT NULL
- `gestor_id` uuid FK profiles NOT NULL
- `designer_id` uuid FK profiles NOT NULL
- `site_url` text NOT NULL
- `promotion` text NOT NULL
- `additional_text` text
- `deadline` date
- `priority` art_priority DEFAULT 'normal'
- `status` art_status DEFAULT 'solicitada'
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**art_request_formats** — Formatos por solicitacao + brief da IA
- `id` uuid PK default gen_random_uuid()
- `request_id` uuid FK art_requests NOT NULL
- `format_id` uuid FK art_formats NOT NULL
- `ai_brief` jsonb
- `created_at` timestamptz DEFAULT now()

**art_comments** — Chat de comentarios
- `id` uuid PK default gen_random_uuid()
- `request_id` uuid FK art_requests NOT NULL
- `user_id` uuid FK profiles NOT NULL
- `content` text NOT NULL
- `created_at` timestamptz DEFAULT now()

**art_files** — Arquivos enviados
- `id` uuid PK default gen_random_uuid()
- `request_id` uuid FK art_requests NOT NULL
- `format_id` uuid FK art_formats
- `file_url` text NOT NULL
- `file_name` text NOT NULL
- `version` int DEFAULT 1
- `uploaded_by` uuid FK profiles NOT NULL
- `created_at` timestamptz DEFAULT now()

**art_history** — Historico de artes concluidas
- `id` uuid PK default gen_random_uuid()
- `request_id` uuid FK art_requests NOT NULL
- `site_url` text NOT NULL
- `promotion` text NOT NULL
- `format_name` text NOT NULL
- `format_width` int NOT NULL
- `format_height` int NOT NULL
- `ai_brief` jsonb
- `final_file_url` text
- `approved_at` timestamptz DEFAULT now()
- `approved_by` uuid FK profiles

**site_brands** — Cache de identidade visual dos sites (global, sem workspace_id — mesmo site = mesma marca independente do workspace)
- `id` uuid PK default gen_random_uuid()
- `site_url` text NOT NULL UNIQUE
- `brand_data` jsonb NOT NULL
- `scraped_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

### Permissoes RBAC

Inseridas na tabela `permissions` existente:

| Slug | Descricao |
|------|-----------|
| `art.view` | Ver kanban e solicitacoes atribuidas |
| `art.create` | Criar nova solicitacao |
| `art.manage` | Ver tudo, metricas, gerenciar formatos e permissoes |
| `art.upload` | Upload de arquivos nas solicitacoes |
| `art.approve` | Aprovar ou solicitar ajuste |

### RLS Policies

- **art_requests**: admin (`art.manage`) ve todas do workspace; gestor ve onde `gestor_id = auth.uid()`; designer ve onde `designer_id = auth.uid()`
- **art_request_formats**: acesso herda do art_request pai
- **art_comments**: quem tem acesso ao request pode ler/escrever
- **art_files**: quem tem acesso ao request pode ler; upload requer `art.upload`
- **art_formats**: leitura para todos com `art.view`; escrita para `art.manage`
- **art_history**: leitura para quem tem acesso ao request original

### Trigger

**on_art_status_concluida**: Quando `art_requests.status` muda para `concluida`, insere registros em `art_history` (um por formato) com snapshot dos dados.

### Storage

Bucket `art-files` com policies:
- Upload: usuarios com `art.upload` no workspace
- Leitura: usuarios que tem acesso ao art_request associado

## Estrutura de Arquivos

```
src/
  pages/artes/
    ArtesHub.tsx              # Pagina principal adaptativa
    ArtesNova.tsx             # Formulario nova solicitacao
    ArtesDetalhe.tsx          # Detalhe da solicitacao

  components/artes/
    ArtKanbanBoard.tsx        # Board com 5 colunas
    ArtKanbanColumn.tsx       # Coluna individual
    ArtKanbanCard.tsx         # Card compacto
    ArtBriefViewer.tsx        # Renderiza brief da IA (accordion + tabs)
    ArtCommentChat.tsx        # Chat estilo WhatsApp
    ArtFileUploader.tsx       # Upload drag-drop + preview + versoes
    ArtRequestForm.tsx        # Formulario de solicitacao
    ArtRequestList.tsx        # Tabela com filtros e paginacao
    ArtMetricsDashboard.tsx   # KPIs + graficos (admin)
    ArtFormatManager.tsx      # CRUD formatos (admin)
    ArtPermissionManager.tsx  # Atribuir permissoes (admin)
    ArtStatusBadge.tsx        # Badge colorido de status

  types/artes.ts              # Types TypeScript
  hooks/useArtes.ts           # React Query hooks

supabase/functions/
  generate-brief/index.ts     # Edge Function Claude API
```

## Rotas

```
/dashboard/artes           → ArtesHub (adaptativo por permissao)
/dashboard/artes/nova      → ArtesNova (requer art.create)
/dashboard/artes/:id       → ArtesDetalhe (requer art.view)
/dashboard/artes/formatos  → ArtesHub tab formatos (requer art.manage)
/dashboard/artes/usuarios  → ArtesHub tab permissoes (requer art.manage)
```

## Sidebar

Novo grupo "Artes" no AppSidebar com itens dinamicos por permissao:
- Todos com `art.view`: "Artes" → /dashboard/artes
- Com `art.create`: "+ Nova Solicitacao" → /dashboard/artes/nova
- Com `art.manage`: "Formatos" → /dashboard/artes/formatos, "Permissoes" → /dashboard/artes/usuarios

## ArtesHub — Pagina Principal

Pagina adaptativa que renderiza conteudo por permissao via tabs.

**Admin** (`art.manage`): Tabs Kanban | Solicitacoes | Metricas | Formatos | Permissoes
**Gestor** (`art.create`): Tabs Kanban | Minhas Solicitacoes
**Designer** (`art.upload`): Tabs Kanban | Minhas Artes

### Kanban

5 colunas com cores:
- Solicitada (azul)
- Realizando (amarelo)
- Ajustando (laranja)
- Aprovacao (roxo)
- Concluida (verde)

Filtragem por perfil:
- Admin: todas do workspace
- Gestor: apenas as que criou
- Designer: apenas as atribuidas

Drag-and-drop (apenas designer, nas suas artes):
- Solicitada → Realizando (unica transicao permitida)
- Realizando → Aprovacao
- Ajustando → Aprovacao (apos corrigir ajuste)
- Concluida: apenas via aprovacao do gestor

Cards mostram: promocao, site, badges de formatos, prioridade (vermelho pulsante se urgente), prazo, data.

Auto-refresh a cada 30 segundos via React Query refetchInterval.

### Metricas (Admin)

- Cards KPI: total por status, tempo medio de conclusao
- Grafico barras: artes por mes (recharts)
- Ranking: designers e gestores por volume

### Lista de Solicitacoes

- Tabela com colunas: promocao, site, designer/gestor, status, prioridade, prazo, data
- Filtros: status, designer, gestor, data, prioridade
- Busca por texto
- Paginacao
- Ordenacao por data, prioridade, status

## ArtesNova — Formulario

Campos:
1. URL do site (obrigatorio, validacao URL)
2. Formatos (obrigatorio, checkboxes multiplos)
3. Oferta/Promocao (obrigatorio, input texto)
4. Designer (obrigatorio, select com usuarios que tem art.upload)
5. Texto adicional (opcional, textarea)
6. Prazo (opcional, date picker, sem datas passadas)
7. Prioridade (switch, default normal)

Fluxo pos-submit:
1. Criar art_request (status: solicitada)
2. Criar art_request_formats por formato
3. Chamar Edge Function generate-brief
4. Loading animado: "A IA esta analisando o site e gerando o brief..."
5. Ao concluir: redirecionar para /dashboard/artes/:id

## ArtesDetalhe — Detalhe da Solicitacao

Layout 70/30 (principal / sidebar).

### Area Principal (70%)

**Info**: site, promocao, designer, prazo, prioridade, datas, status badge.

**BriefViewer**: Tabs por formato (se multiplos). Cada tab com accordion:
- Conceito Visual
- Paleta de Cores (quadrados coloridos com hex + descricao de uso)
- Tipografia
- Layout e Posicionamento (lista de elementos com posicao e tamanho)
- Elementos Visuais
- Textos (blocos destacados)
- Passo a Passo (checkboxes interativos, estado local)
- Referencias de Estilo
- Observacoes Finais

**FileUploader**: Drop zone, aceita PNG/JPG/PDF/PSD/AI, preview para imagens, lista com versoes, upload para Storage bucket art-files.

### Sidebar Direita (30%)

**CommentChat**: Bolhas estilo WhatsApp, avatar + nome + timestamp, usuario logado a direita (cor accent), outro a esquerda (cor muted), auto-scroll, input fixo embaixo. Real-time via Supabase Realtime.

**Acoes por perfil**:
- Designer: upload, enviar para aprovacao, marcar passo a passo
- Gestor: aprovar (→ concluida + trigger historico), solicitar ajuste (→ ajustando + comentario obrigatorio), regerar brief
- Admin: tudo acima + reatribuir designer + editar prioridade

## Edge Function: generate-brief

### Fluxo

1. Valida JWT do usuario
2. Busca cache em site_brands (valido se updated_at < 7 dias)
3. Se sem cache: fetch HTML do site, extrai title, meta, cores CSS, textos (h1/h2/p), imagens (og:image, logos)
4. Salva/atualiza site_brands
5. Monta prompt para Claude API com dados do site + promocao + formatos + texto adicional
6. Chama Claude (claude-sonnet-4-6) pedindo JSON estruturado com brief por formato
7. Salva briefs em art_request_formats.ai_brief
8. Retorna { success: true, briefs: { [formatId]: briefJson } }

### Estrutura do Brief (JSON)

```json
{
  "conceito_visual": "string",
  "paleta_cores": [
    { "hex": "#FF5733", "nome": "Laranja Vibrante", "uso": "CTA e destaques" }
  ],
  "tipografia": {
    "titulo": "string",
    "subtitulo": "string",
    "corpo": "string"
  },
  "layout": {
    "formato": "Feed 1080x1080",
    "grid": "string",
    "elementos": [
      { "nome": "Logo", "posicao": "Topo esquerdo", "tamanho": "10% da area" }
    ]
  },
  "elementos_visuais": "string",
  "textos": {
    "headline": "string",
    "subtitulo": "string",
    "cta": "string",
    "legal": "string"
  },
  "passo_a_passo": ["string"],
  "referencias_estilo": "string",
  "observacoes": "string"
}
```

### Configuracao

- Secret: `ANTHROPIC_API_KEY` via `supabase secrets set`
- Modelo: claude-sonnet-4-6
- Timeout: ate 150s (suportado por Edge Functions)

### Erros

- Site inacessivel: erro amigavel, request criado sem brief, gestor pode retentar
- Claude API falha: 1 retry, se falhar retorna erro
- Botao "Regerar Brief" na tela de detalhe permite retentar

## Fora do Escopo

- Notificacoes push/email
- Historico de versoes do brief (so o ultimo)
- Exportacao de relatorios
- Integracao com ferramentas de design (Figma, Canva)
- Testes automatizados
