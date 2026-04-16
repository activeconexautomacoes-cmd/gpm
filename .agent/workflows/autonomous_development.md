---
description: Rotina Autônoma de Correção e Melhoria de Chamados (Aprovados)
---
# Rotina de Desenvolvimento Autônomo - Execução Única

**Sua missão nesta execução é:** Buscar e desenvolver exatamente UM (1) chamado aprovado do sistema, testá-lo e então marcá-lo como "Desenvolvido". 

Siga estritamente estes passos ordenados:

## Passo 1: Busca do Chamado
Utilize o MCP do Supabase (`mcp_supabase-mcp-server_execute_sql`) para rodar esta query na tabela `system_requests` do projeto Supabase:
```sql
SELECT * FROM system_requests WHERE status = 'approved' ORDER BY created_at ASC LIMIT 1;
```
*Se nenhum chamado for retornado, informe que não há chamados aprovados no momento e finalize o processamento.*

## Passo 2: Contextualização e Pesquisa
Analise cuidadosamente a `description` e o `title` do chamado. 
Se você não tiver contexto suficiente sobre alguma biblioteca, integração, ou API necessária para a correção:
- Utilize o **MCP do Perplexity** para pesquisas web de documentações ou exemplos recentes.
- Utilize ferramentas de busca local (`grep_search` ou `codebase_search`) para entender as dependências do código local de envio deste módulo.

## Passo 3: Desenvolvimento e Implementação
Crie, edite ou exclua os arquivos no código atual para implementar a solução deste chamado específico de forma robusta e limpa.
Você pode corrigir o bug ou iniciar a melhoria sugerida. 
**Regra de Ouro:** Não implemente mais do que foi pedido neste chamado único. Apenas resolva o escopo que está descrito no ticket e faça uso das melhores práticas de codificação do projeto.

## Passo 4: Testes Sistêmicos (Agent Mode)
O projeto provavelmente já está rodando (via `npm run dev`). 
- Certifique-se da URL local (geralmente `http://localhost:5173`).
- Utilize sua ferramenta de **`browser_subagent`** para abrir o navegador, logar (se necessário), navegar até a página modificada e validar interativamente que a correção ou feature nova surtiu efeito, não gerou erros visuais, e que não houve quebra de usabilidade.
- Analise os resultados da sessão web com base neste teste para garantir que esteja tudo certo. Se algo deu falha, refaça o código e teste novamente até atingir a completude.

## Passo 5: Atualização de Status
Após ter testado e comprovado que a solução foi um sucesso:
Execute novamente o MCP do Supabase para atualizar a tabela `system_requests`:
```sql
UPDATE system_requests SET status = 'developed', updated_at = NOW() WHERE id = '[COLOQUE O ID DO CHAMADO AQUI]';
```
Dessa forma, o administrador poderá validar que a correção foi desenvolvida de fato.

*Conclua informando em português pro usuário um resumo conciso do que foi modificado em relação ao chamado [Título do Chamado]!*
