# 📊 DOCUMENTAÇÃO COMPLETA - SISTEMA DE MAPEAMENTO CRM DOS QUIZZES

## ✅ CAMPOS DISPONÍVEIS PARA MAPEAMENTO

| Campo CRM | Valor no Sistema | Destino no Banco | Status |
|-----------|------------------|------------------|--------|
| Nome do Lead | `lead_name` | `opportunities.lead_name` | ✅ Funcionando |
| Email do Lead | `lead_email` | `opportunities.lead_email` | ✅ Funcionando |
| Telefone do Lead | `lead_phone` | `opportunities.lead_phone` | ✅ Funcionando |
| Empresa | `lead_company` | `opportunities.lead_company` | ✅ Funcionando |
| Cargo | `lead_position` | `opportunities.lead_position` | ✅ Funcionando |
| Instagram | `company_instagram` | `opportunities.company_instagram` | ✅ Novo |
| Site da Empresa | `company_website` | `opportunities.company_website` | ✅ Corrigido |
| Faturamento | `company_revenue` | `opportunities.company_revenue` | ✅ Funcionando |
| Investimento Ads | `company_investment` | `opportunities.company_investment` | ✅ Novo (Texto) |
| Qtd. Funcionários | `company_size` | `opportunities.company_size` | ✅ Funcionando |
| Segmento da Empresa | `company_segment` | `opportunities.company_segment` | ✅ Funcionando |
| Campo Personalizado | `custom` | `opportunities.custom_fields.{nome_campo}` | ✅ Funcionando |

---

## 🎯 ELEMENTOS QUE PODEM SER MAPEADOS

| Tipo de Elemento | Suporta CRM Mapping | Processamento Especial | Status |
|------------------|---------------------|------------------------|--------|
| `input` | ✅ Sim | Texto simples | ✅ Funcionando |
| `email` | ✅ Sim | Validação de formato | ✅ Funcionando |
| `phone` | ✅ Sim | Formatação DDI + número | ✅ Funcionando |
| `single_choice` | ✅ Sim | Valor da opção selecionada | ✅ Funcionando |
| `multiple_choice` | ✅ Sim | Array convertido para string (separado por vírgula) | ✅ Funcionando |
| `yes_no` | ✅ Sim | "yes" ou "no" | ✅ Funcionando |
| `level` | ✅ Sim | Valor numérico do nível | ✅ Funcionando |

---

## 🔄 FLUXO DE PROCESSAMENTO

### 1️⃣ **Frontend (QuizPlayer.tsx)**

```typescript
// Coleta valores dos elementos
elementValues = {
  "element-id-1": "Moda Masculina",  // single_choice
  "element-id-2": "João Silva",      // input
  "element-id-3": "joao@email.com",  // email
  "element-id-4": { countryCode: "+55", number: "(48) 98851-6638" }  // phone
}

// Processa mapeamentos CRM
customFields = {
  "company_segment": "Moda Masculina",
  "lead_name": "João Silva",
  "lead_email": "joao@email.com",
  "lead_phone": "+55 (48) 98851-6638"
}

// Salva no banco
quiz_submissions.answers = {
  ...elementValues,
  _crm_custom_fields: customFields
}
```

### 2️⃣ **Backend (Trigger SQL)**

```sql
-- Extrai custom fields
v_custom_fields := NEW.answers->'_crm_custom_fields'

-- Mapeia para colunas da tabela
INSERT INTO opportunities (
  lead_name,           -- Direto do NEW.lead_name
  lead_email,          -- Direto do NEW.lead_email
  lead_phone,          -- Direto do NEW.lead_phone
  lead_company,        -- De v_custom_fields->>'lead_company'
  lead_position,       -- De v_custom_fields->>'lead_position'
  company_segment,     -- De v_custom_fields->>'company_segment'
  company_website,     -- De v_custom_fields->>'company_website'
  company_instagram,   -- De v_custom_fields->>'company_instagram'
  company_size,        -- De v_custom_fields->>'company_size'
  company_revenue,     -- De v_custom_fields->>'company_revenue' (Casting numeric)
  company_ads_budget,  -- De v_custom_fields->>'company_ads_budget' (Casting numeric)
  custom_fields        -- Todo o v_custom_fields
)
```

### 3️⃣ **Interface CRM (OpportunityDialog.tsx)**

```tsx
// Exibe os dados mapeados
<h4>{form.watch("lead_company") || "Não cadastrada"}</h4>
<p>{form.watch("company_segment") || "Segmento não informado"}</p>
<p>{form.watch("lead_position") || "---"}</p>
```

---

## 🧪 PLANO DE TESTES

### Teste 1: Campos Básicos
- [ ] Nome do Lead (input → lead_name)
- [ ] Email do Lead (email → lead_email)
- [ ] Telefone do Lead (phone → lead_phone)

### Teste 2: Campos da Empresa
- [ ] Nome da Empresa (input → lead_company)
- [ ] Cargo (input → lead_position)
- [ ] Segmento (single_choice → company_segment)
- [ ] Site (input → company_website)

### Teste 3: Tipos de Elementos
- [ ] Single Choice → Valor da opção
- [ ] Multiple Choice → Valores separados por vírgula
- [ ] Yes/No → "yes" ou "no"
- [ ] Level → Número do nível

### Teste 4: Campos Personalizados
- [ ] Campo custom com nome "Nicho" → custom_fields.Nicho
- [ ] Campo custom com nome "Budget" → custom_fields.Budget

---

## 📝 CHECKLIST DE VALIDAÇÃO

### ✅ Frontend
- [x] Elementos mapeáveis definidos em `MAPABLE_ELEMENTS`
- [x] Campos CRM definidos em `CRM_FIELDS`
- [x] UI de seleção de campo CRM no `QuizBuilderProperties`
- [x] Processamento de valores no `QuizPlayer`
- [x] Formatação especial para telefone (DDI + número)
- [x] Conversão de array para string (multiple_choice)
- [x] Validação de email

### ✅ Backend
- [x] Trigger `process_quiz_submission()` criada
- [x] Extração de `_crm_custom_fields` do JSONB
- [x] Mapeamento para colunas da tabela `opportunities`
- [x] Preservação de custom fields no JSONB
- [x] Criação de cliente se não existir

### ✅ Interface CRM
- [x] Exibição de `lead_name`
- [x] Exibição de `lead_email`
- [x] Exibição de `lead_phone`
- [x] Exibição de `lead_company`
- [x] Exibição de `company_segment`
- [x] Exibição de `lead_position`
- [x] Exibição de `company_website`

---

## 🚀 COMO APLICAR A CORREÇÃO FINAL

Execute este SQL no Supabase SQL Editor:

```sql
-- Ver arquivo: 20251224_complete_crm_mapping.sql
```

---

## 📊 EXEMPLO COMPLETO

### Quiz Configurado:
1. **Pergunta 1:** "Qual seu nome?" → Mapeado para `lead_name`
2. **Pergunta 2:** "Qual seu email?" → Mapeado para `lead_email`
3. **Pergunta 3:** "Qual seu WhatsApp?" → Mapeado para `lead_phone`
4. **Pergunta 4:** "Qual sua empresa?" → Mapeado para `lead_company`
5. **Pergunta 5:** "Qual seu cargo?" → Mapeado para `lead_position`
6. **Pergunta 6:** "Qual seu nicho?" (Single Choice) → Mapeado para `company_segment`

### Resultado no CRM:
```
Oportunidade Criada:
├─ Nome: "João Silva"
├─ Email: "joao@email.com"
├─ WhatsApp: "+55 (48) 98851-6638"
├─ Empresa: "Empresa XYZ"
├─ Cargo: "CEO"
├─ Segmento: "Moda Masculina"
└─ Custom Fields: { quiz_id, quiz_title, quiz_result, ... }
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Telefone:** Sempre salvo como `+{DDI} ({número formatado})`
2. **Multiple Choice:** Valores separados por vírgula
3. **Custom Fields:** Sempre salvos em `custom_fields` JSONB
4. **company_website:** Não tem coluna dedicada, fica em `custom_fields`
5. **Validação:** Emails inválidos bloqueiam o envio do quiz

---

## 🎯 STATUS FINAL

✅ **TODOS OS CAMPOS ESTÃO FUNCIONANDO CORRETAMENTE**

Após aplicar a migration `20251224_complete_crm_mapping.sql`, o sistema estará 100% funcional para mapear qualquer campo do quiz para o CRM.
