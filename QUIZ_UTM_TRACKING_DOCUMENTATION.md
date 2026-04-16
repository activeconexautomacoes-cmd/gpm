# 📊 SISTEMA DE RASTREAMENTO UTM - QUIZ

## ✅ IMPLEMENTAÇÃO COMPLETA

O sistema agora captura automaticamente os parâmetros UTM da URL do quiz e os exibe no CRM para rastreamento de origem dos leads.

---

## 🎯 PARÂMETROS UTM CAPTURADOS

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `utm_source` | Origem do tráfego | `facebook`, `google`, `instagram` |
| `utm_medium` | Meio/Canal | `cpc`, `email`, `social` |
| `utm_campaign` | Nome da campanha | `black_friday_2024`, `lancamento_produto` |
| `utm_term` | Palavra-chave (Google Ads) | `quiz+marketing`, `ferramenta+crm` |
| `utm_content` | Variação do anúncio | `banner_azul`, `video_15s` |

---

## 🔄 FLUXO DE FUNCIONAMENTO

### 1️⃣ **Usuário Acessa o Quiz com UTMs**

```
https://seusite.com/quiz/meu-quiz?utm_source=facebook&utm_medium=cpc&utm_campaign=black_friday
```

### 2️⃣ **Sistema Captura os UTMs**

- Extrai todos os parâmetros `utm_*` da URL
- Salva no `localStorage` para persistir durante a navegação
- Armazena no estado do componente

### 3️⃣ **Usuário Completa o Quiz**

- Responde todas as perguntas
- Clica em "Enviar" ou "Finalizar"

### 4️⃣ **Sistema Salva os UTMs**

```javascript
custom_fields: {
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "black_friday",
  "utm_term": "quiz marketing",
  "utm_content": "banner azul",
  // ... outros campos personalizados
}
```

### 5️⃣ **Vendedor Vê no CRM**

Na seção **"Origem"** da oportunidade:

```
┌─────────────────────────────┐
│ ORIGEM                      │
├─────────────────────────────┤
│ Origem: Site                │
│                             │
│ PARÂMETROS UTM              │
│ ┌─────────────────────────┐ │
│ │ Source    │ facebook    │ │
│ │ Medium    │ cpc         │ │
│ │ Campaign  │ black_friday│ │
│ │ Term      │ quiz market │ │
│ │ Content   │ banner azul │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## 📝 EXEMPLOS DE USO

### **Exemplo 1: Campanha Facebook Ads**

**URL:**
```
/quiz/qualificacao?utm_source=facebook&utm_medium=cpc&utm_campaign=leads_q1_2024&utm_content=video_30s
```

**Resultado no CRM:**
- Source: `facebook`
- Medium: `cpc`
- Campaign: `leads_q1_2024`
- Content: `video_30s`

**Interpretação:** Lead veio de um anúncio pago no Facebook, campanha Q1 2024, variação com vídeo de 30s

---

### **Exemplo 2: Email Marketing**

**URL:**
```
/quiz/diagnostico?utm_source=newsletter&utm_medium=email&utm_campaign=dezembro_2024
```

**Resultado no CRM:**
- Source: `newsletter`
- Medium: `email`
- Campaign: `dezembro_2024`

**Interpretação:** Lead veio da newsletter, campanha de dezembro

---

### **Exemplo 3: Influenciador**

**URL:**
```
/quiz/avaliacao?utm_source=instagram&utm_medium=influencer&utm_campaign=parceria_joao&utm_content=stories
```

**Resultado no CRM:**
- Source: `instagram`
- Medium: `influencer`
- Campaign: `parceria_joao`
- Content: `stories`

**Interpretação:** Lead veio do Instagram, através do influenciador João, via stories

---

## 🎨 INTERFACE NO CRM

### **Localização:**
- Coluna esquerda
- Seção "Origem"
- Logo após o seletor de origem

### **Visual:**
- Design limpo e compacto
- Fundo cinza claro para cada parâmetro
- Labels em maiúsculas
- Valores em negrito

### **Comportamento:**
- Só aparece se houver pelo menos 1 UTM
- Exibe apenas os UTMs que foram capturados
- Não mostra campos vazios

---

## 🔧 DETALHES TÉCNICOS

### **Persistência:**
```javascript
// Salvo no localStorage
localStorage.setItem('quiz_utms', JSON.stringify({
  utm_source: 'facebook',
  utm_medium: 'cpc',
  ...
}));

// Recuperado se o usuário navegar entre páginas
const savedUtms = localStorage.getItem('quiz_utms');
```

### **Banco de Dados:**
```sql
-- Tabela: opportunities
-- Coluna: custom_fields (JSONB)

{
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "black_friday",
  "utm_term": "quiz marketing",
  "utm_content": "banner azul",
  "company_segment": "E-commerce",
  "Investimento": "R$1k a R$5k",
  ...
}
```

---

## 📊 CASOS DE USO

### **1. Análise de ROI por Canal**
- Filtrar leads por `utm_source`
- Calcular taxa de conversão por canal
- Identificar canais mais rentáveis

### **2. Otimização de Campanhas**
- Comparar performance entre campanhas (`utm_campaign`)
- Identificar variações de anúncio mais efetivas (`utm_content`)
- Ajustar investimento baseado em resultados

### **3. Rastreamento de Influenciadores**
- Criar UTMs únicos para cada influenciador
- Medir quantos leads cada um trouxe
- Calcular ROI de parcerias

### **4. Teste A/B de Criativos**
- Usar `utm_content` para diferentes versões
- Comparar taxa de conversão
- Escolher melhor criativo

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] UTMs são capturados da URL
- [x] UTMs persistem no localStorage
- [x] UTMs são salvos no banco de dados
- [x] UTMs aparecem na seção "Origem" do CRM
- [x] Apenas UTMs preenchidos são exibidos
- [x] Design consistente com o resto do CRM
- [x] Funciona em todas as páginas do quiz

---

## 🚀 COMO TESTAR

1. **Acesse o quiz com UTMs:**
   ```
   http://localhost:5173/quiz/seu-quiz?utm_source=teste&utm_medium=manual&utm_campaign=validacao
   ```

2. **Complete o quiz**

3. **Vá ao CRM**

4. **Abra a oportunidade criada**

5. **Verifique a seção "Origem"**
   - Deve aparecer "PARÂMETROS UTM"
   - Deve mostrar: Source: teste, Medium: manual, Campaign: validacao

---

## 📈 PRÓXIMOS PASSOS (OPCIONAL)

- [ ] Dashboard de analytics por UTM
- [ ] Relatório de ROI por canal
- [ ] Integração com Google Analytics
- [ ] Alertas para campanhas com baixa conversão
- [ ] Exportação de dados para análise

---

## 🎯 STATUS FINAL

**✅ IMPLEMENTADO E FUNCIONANDO!**

O sistema de rastreamento UTM está 100% operacional e pronto para uso em produção.
