function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('pt-BR');
}

function formatPct(pct) {
  if (pct === undefined || pct === null || isNaN(pct)) return '0,00%';
  return Number(pct).toFixed(2).replace('.', ',') + '%';
}

// Polling dos Dados Oficiais do TSE
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Erro ao buscar status do TSE:', err);
  }
}

function renderDashboard(data) {
  // Metadados do TSE
  if (data.ultima_atualizacao) {
    document.getElementById('tse-update-time').innerText = data.ultima_atualizacao;
  }

  // Barra de Apuração Nacional Real
  const pctApurado = data.pct_apurado || 0;
  document.getElementById('progress-bar-fill').style.width = Math.min(100, pctApurado) + '%';
  document.getElementById('progress-stats').innerText = 
    `${formatPct(pctApurado)} apurado oficialmente (${formatNumber(data.secoes_apuradas)} de ${formatNumber(data.total_secoes)} seções)`;

  // Placar Real 2º Turno
  const lulaVotos2t = data.lula_votos_2t || 0;
  const flavioVotos2t = data.flavio_votos_2t || 0;
  const lulaPct2t = data.lula_pct_2t || 0;
  const flavioPct2t = data.flavio_pct_2t || 0;

  document.getElementById('lula-pct-2t').innerText = formatPct(lulaPct2t);
  document.getElementById('flavio-pct-2t').innerText = formatPct(flavioPct2t);
  document.getElementById('lula-votes-2t').innerText = formatNumber(lulaVotos2t);
  document.getElementById('flavio-votes-2t').innerText = formatNumber(flavioVotos2t);

  // Termômetro Proporcional
  document.getElementById('ratio-pct-lula').innerText = formatPct(lulaPct2t);
  document.getElementById('ratio-pct-flavio').innerText = formatPct(flavioPct2t);
  document.getElementById('ratio-bar-lula').style.width = (lulaPct2t || 50) + '%';
  document.getElementById('ratio-bar-flavio').style.width = (flavioPct2t || 50) + '%';

  // 1º Turno (proporcional às seções já abertas)
  const lulaVotos1t = data.lula_votos_1t_mesmas || 0;
  const flavioVotos1t = data.flavio_votos_1t_mesmas || 0;
  const lulaPct1t = data.lula_pct_1t_mesmas || 45.17;
  const flavioPct1t = data.flavio_pct_1t_mesmas || 47.03;

  // Gráficos de Barras Lado a Lado (1T vs 2T Real)
  // Lula
  const lulaMax = Math.max(lulaVotos1t, lulaVotos2t, 1);
  const lulaH1t = Math.max(16, (lulaVotos1t / lulaMax) * 100);
  const lulaH2t = Math.max(16, (lulaVotos2t / lulaMax) * 100);

  document.getElementById('lula-bar-fill-1t').style.height = lulaH1t + '%';
  document.getElementById('lula-bar-fill-2t').style.height = lulaH2t + '%';
  document.getElementById('lula-bar-pct-1t').innerText = formatPct(lulaPct1t);
  document.getElementById('lula-bar-pct-2t').innerText = formatPct(lulaPct2t);
  document.getElementById('lula-bar-val-1t').innerText = formatNumber(lulaVotos1t);
  document.getElementById('lula-bar-val-2t').innerText = formatNumber(lulaVotos2t);

  // Flávio
  const flavioMax = Math.max(flavioVotos1t, flavioVotos2t, 1);
  const flavioH1t = Math.max(16, (flavioVotos1t / flavioMax) * 100);
  const flavioH2t = Math.max(16, (flavioVotos2t / flavioMax) * 100);

  document.getElementById('flavio-bar-fill-1t').style.height = flavioH1t + '%';
  document.getElementById('flavio-bar-fill-2t').style.height = flavioH2t + '%';
  document.getElementById('flavio-bar-pct-1t').innerText = formatPct(flavioPct1t);
  document.getElementById('flavio-bar-pct-2t').innerText = formatPct(flavioPct2t);
  document.getElementById('flavio-bar-val-1t').innerText = formatNumber(flavioVotos1t);
  document.getElementById('flavio-bar-val-2t').innerText = formatNumber(flavioVotos2t);

  // Deltas
  const deltaLula = data.delta_lula || 0;
  const deltaFlavio = data.delta_flavio || 0;
  const pctCrescimentoLula = lulaVotos1t > 0 ? (deltaLula / lulaVotos1t) * 100 : 0;
  const pctCrescimentoFlavio = flavioVotos1t > 0 ? (deltaFlavio / flavioVotos1t) * 100 : 0;

  updateBadge('lula-delta-badge', deltaLula, pctCrescimentoLula);
  updateBadge('flavio-delta-badge', deltaFlavio, pctCrescimentoFlavio);
}

function updateBadge(id, delta, pct) {
  const badge = document.getElementById(id);
  const sign = delta >= 0 ? '+' : '';
  badge.className = `delta-badge ${delta >= 0 ? 'delta-positive' : 'delta-negative'}`;
  badge.innerText = `${sign}${formatNumber(delta)} (${sign}${formatPct(pct)})`;
}

// Consulta de Seção Específica (Urna a Urna)
async function buscarSecao() {
  const uf = document.getElementById('search-uf').value;
  const zona = document.getElementById('search-zona').value;
  const secao = document.getElementById('search-secao').value;
  const container = document.getElementById('secao-resultado');

  if (!zona || !secao) {
    alert('Informe a Zona e a Seção eleitoral.');
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 12px;">Consultando dados oficiais da Seção ${secao} (Zona ${zona} - ${uf})...</div>`;

  try {
    const res = await fetch(`/api/secao?uf=${uf}&zona=${zona}&secao=${secao}`);
    const data = await res.json();

    if (data.error) {
      container.innerHTML = `<div style="color: #fca5a5; padding: 10px;">⚠️ ${data.error}</div>`;
      return;
    }

    renderCardSecao(data);
  } catch (err) {
    container.innerHTML = `<div style="color: #fca5a5; padding: 10px;">Erro ao consultar seção: ${err.message}</div>`;
  }
}

function preencherExemplo(uf, zona, secao) {
  document.getElementById('search-uf').value = uf;
  document.getElementById('search-zona').value = zona;
  document.getElementById('search-secao').value = secao;
  buscarSecao();
}

function renderCardSecao(data) {
  const container = document.getElementById('secao-resultado');
  const tem2T = data.lula_2t !== null && data.lula_2t !== undefined;

  let statusBadge = tem2T
    ? `<span class="badge-status badge-virou">VOTOS APURADOS</span>`
    : `<span class="badge-status" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">⏳ ${data.status_2t}</span>`;

  container.innerHTML = `
    <div class="secao-header">
      <div>
        <h3>📍 Seção ${data.secao} • Zona ${data.zona} — ${data.nm_mun} (${data.uf})</h3>
        <span style="font-size: 12px; color: var(--text-dim);">Chave única: ${data.chave} • Vencedor 1ºT: <strong>${data.vencedor_1t}</strong></span>
      </div>
      <div>
        ${statusBadge}
      </div>
    </div>

    <div class="secao-grid">
      <!-- Caixa Lula -->
      <div class="cand-res-box lula">
        <h4 style="color: #fca5a5; margin-bottom: 8px;">13 - LULA</h4>
        <div class="cand-res-row">
          <span>Votos no 1º Turno:</span>
          <strong>${formatNumber(data.lula_1t)} votos (${formatPct(data.pct1_lula)})</strong>
        </div>
        <div class="cand-res-row">
          <span>Votos no 2º Turno:</span>
          <strong style="color: var(--lula-color);">${tem2T ? formatNumber(data.lula_2t) + ' votos' : 'Aguardando apuração da urna'}</strong>
        </div>
      </div>

      <!-- Caixa Flávio -->
      <div class="cand-res-box flavio">
        <h4 style="color: #93c5fd; margin-bottom: 8px;">22 - FLÁVIO BOLSONARO</h4>
        <div class="cand-res-row">
          <span>Votos no 1º Turno:</span>
          <strong>${formatNumber(data.flavio_1t)} votos (${formatPct(data.pct1_flavio)})</strong>
        </div>
        <div class="cand-res-row">
          <span>Votos no 2º Turno:</span>
          <strong style="color: var(--flavio-color);">${tem2T ? formatNumber(data.flavio_2t) + ' votos' : 'Aguardando apuração da urna'}</strong>
        </div>
      </div>
    </div>
  `;
}

async function forcarAtualizacao() {
  const btn = document.querySelector('button[onclick="forcarAtualizacao()"]');
  btn.innerText = '⏳ Consultando TSE...';
  try {
    await fetch('/api/forcar_atualizacao');
    await fetchStatus();
  } catch (err) {
    console.error(err);
  } finally {
    btn.innerText = '🔄 Atualizar TSE Agora';
  }
}

// Inicia polling a cada 5 segundos
setInterval(fetchStatus, 5000);
fetchStatus();
preencherExemplo('SP', 82, 92);
