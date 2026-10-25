# 🇧🇷 Comparador de Votação Urna a Urna (1ºT vs 2ºT) - Eleição 2026

Sistema de acompanhamento eleitoral em tempo real que cruza os dados oficiais de cada seção eleitoral (urna a urna) do 1º Turno com a apuração do 2º Turno (Lula 13 vs Flávio Bolsonaro 22).

## 🚀 Funcionalidades
- **Confronto direto Urna a Urna:** Permite consultar qualquer seção eleitoral do país (por UF, Zona e Seção) e comparar os votos de Lula e Flávio entre os turnos.
- **Detecção de Viradas:** Identifica seções onde o resultado do 1º Turno foi revertido no 2º Turno.
- **Métrica de Swing / Delta:** Calcula o ganho ou perda líquida de votos em cada seção.
- **Conexão Oficial com API do TSE:** Integração com os dados oficiais transmitidos pela Justiça Eleitoral.
- **Simulador 2T:** Permite simular a apuração das ~499 mil seções em tempo real para testes e projeções.

## 🛠️ Como Executar Localmente
1. Dê um duplo clique no arquivo `iniciar_apuracao.bat` ou execute:
```bash
python server.py
```
2. Acesse no navegador: `http://localhost:8000`

## ☁️ Deploy no Render
- **Environment:** Python
- **Build Command:** `pip install -r requirements.txt` (ou deixe vazio)
- **Start Command:** `python server.py`
