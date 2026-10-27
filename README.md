# 🇧🇷 Comparador de Votação (1ºT vs 2ºT) - Eleição Presidencial 2026

Sistema eleitoral de alta performance que cruza os dados oficiais consolidados de cada seção eleitoral do país (urna a urna) do 1º Turno com o 2º Turno (Lula 13 vs Flávio Bolsonaro 22), com **detalhamento completo por Municípios, Bairros e Colégios Eleitorais**.

## 🚀 Funcionalidades

### 1. 🇧🇷 Visão Nacional & Urna a Urna
- **Confronto direto Seção a Seção (100% Offline):** Consulta qualquer urna por UF, Zona e Seção com nome da escola, endereço, bairro e CEP.
- **Detecção de Viradas:** Mapeamento de todas as **31.395 seções** onde Flávio venceu no 1T e Lula virou no 2T, e **565 seções** viradas para Flávio.
- **Métricas de Swing e Delta:** Ganho líquido e variação de margem urna a urna.

### 2. 🏙️ Dashboard por Cidades (5.570 Municípios)
- **Filtro por Estado e Busca Instantânea por Nome:** Visualize qualquer cidade do país com placar 1T vs 2T.
- **Detecção de Viradas Municipais:** Ranking de cidades que mudaram de vencedor entre os turnos.
- **Contagem de Seções Viradas por Cidade:** Ex: na capital paulista, **2.971 seções** viraram de Flávio para Lula.

### 3. 🏘️ Dashboard por Bairros & Escolas (51.730 Bairros)
- **Detalhamento Intra-Urbano Oficial:** Distribuição territorial dos votos por bairro (ex: Vila Mariana, Copacabana, Tijuca, Moema, etc.).
- **Filtros e Ordenação:** Bairros mais lulistas, mais bolsonaristas, ou com maiores viradas.
- **Mapeamento de Colégios Eleitorais:** Placar acumulado nos maiores estabelecimentos de ensino de cada cidade.

## 🛠️ Como Executar Localmente
1. Dê um duplo clique no arquivo `iniciar_apuracao.bat` ou execute:
```bash
python server.py
```
2. Acesse no navegador: `http://localhost:8000`

## 🔄 Como Reindexar e Atualizar os Dados
```bash
python download_dados_2t.py
python indexador_consolidado.py
python download_bairros.py
python enriquecer_com_bairros.py
```
