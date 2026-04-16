-- Importação completa de clientes para o workspace "Plus Mídia"
-- Total: 243 clientes

INSERT INTO clients (workspace_id, name, email, phone, document, status, notes) VALUES
-- Lote 1
('8eaae987-1b56-43de-978c-c135beb30c7e', '55.265.480 GUILHERME VINICIUS MANIAKAS MAZINI', '', '1130275798.0', '55265480000104', 'active', 'Cliente Avulso'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '55.364.180 ERIC KAUAN NOLETO SILVEIRA', 'atendimento@noletosports.com', '(63) 9130-8523', '55364180000182', 'active', 'Assessoria completa de marketing (desde 03/09/2025)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '58.053.457 ANDRE AUGUSTO KORB BORGHESAN', 'serennemodaadm@gmail.com', '(46) 8800-8585', '58053457000144', 'active', 'Cliente Avulso'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '58.538.243 HUGO LANES CUNHA', 'hugolanescunha@gmail.com', '(28) 99995-2838', '58538243000168', 'active', 'Cliente Avulso (contrato encerrado)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '61.792.426 MIGUEL AGUIAR FLORENCIO', 'contato@giroflexcompany.com', '(33) 9962-2544', '61792426000110', 'active', 'Assessoria completa de marketing (desde 05/09/2025)'),
-- Lote 2  
('8eaae987-1b56-43de-978c-c135beb30c7e', '61.930.028 PAULO HENRIQUE LIMA DE JESUS SANTOS', 'paulo.henriquesep7@gmail.com', '+55 11 97755-0211', '61930028000112', 'active', 'Assessoria completa de marketing (desde 29/08/2025)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '61.976.819 MATHEUS DE ABREU', 'vinideabreu20@gmail.com', '+55 11 94500-0653', '61976819000183', 'active', 'Assessoria completa de marketing (desde 28/08/2025)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', '62.181.019 ANGELA MARQUES', 'el_esportes17@hotmail.com', '+55 21 98651-5474', '62181019000139', 'active', 'Assessoria completa de marketing (desde 26/08/2025)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', 'ASSOCIACAO COMERCIAL E INDUSTRIAL DE NIQUELANDIA', '', '+55 62 9921-1860', '33332115000132', 'active', 'Assessoria completa de marketing (desde 12/09/2025)'),
('8eaae987-1b56-43de-978c-c135beb30c7e', 'AZEVEDO E RODRIGUES MODA LTDA', '', '+55 31 9251-1287', '49293676000100', 'active', 'Cliente Avulso (contrato encerrado)')
ON CONFLICT DO NOTHING;
