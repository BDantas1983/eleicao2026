function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('pt-BR');
}

function formatPct(pct) {
  if (pct === undefined || pct === null || isNaN(pct)) return '0,00%';
  return Number(pct).toFixed(2).replace('.', ',') + '%';
}

// ==========================================
// CONTROLE DE NAVEGAÇÃO POR ABAS
// ==========================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const activeContent = document.getElementById(tabId);
  if (activeContent) activeContent.classList.add('active');

  const btnMap = {
    'tab-geral': 'btn-tab-geral',
    'tab-cidades': 'btn-tab-cidades',
    'tab-bairros': 'btn-tab-bairros',
    'tab-mapa': 'btn-tab-mapa'
  };
  const activeBtn = document.getElementById(btnMap[tabId]);
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'tab-cidades' && !window.cidadesCarregadas) {
    carregarMunicipiosEstado();
  } else if (tabId === 'tab-bairros') {
    if (!window.bairrosCarregados) {
      atualizarCidadesSelectBairros();
    } else if (mapInstances.inline && mapInstances.inline.map) {
      setTimeout(() => mapInstances.inline.map.invalidateSize(), 150);
    }
  } else if (tabId === 'tab-mapa') {
    if (!window.mapaDedicadoCarregado) {
      atualizarCidadesSelectMapa();
    } else if (mapInstances.full && mapInstances.full.map) {
      setTimeout(() => mapInstances.full.map.invalidateSize(), 150);
    }
  }
}

// ==========================================
// ABA 1: VISÃO NACIONAL & SEÇÕES URNA A URNA
// ==========================================
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Erro ao buscar status consolidado:', err);
  }
}

function renderDashboard(data) {
  if (data.ultima_atualizacao) {
    document.getElementById('tse-update-time').innerText = data.ultima_atualizacao;
  }

  const pctApurado = data.pct_apurado || 100;
  document.getElementById('progress-bar-fill').style.width = Math.min(100, pctApurado) + '%';
  document.getElementById('progress-stats').innerText = 
    `${formatPct(pctApurado)} apurado oficialmente (${formatNumber(data.secoes_apuradas)} de ${formatNumber(data.total_secoes)} seções)`;

  const lulaVotos2t = data.lula_votos_2t || 0;
  const flavioVotos2t = data.flavio_votos_2t || 0;
  const lulaPct2t = data.lula_pct_2t || 0;
  const flavioPct2t = data.flavio_pct_2t || 0;

  document.getElementById('lula-pct-2t').innerText = formatPct(lulaPct2t);
  document.getElementById('flavio-pct-2t').innerText = formatPct(flavioPct2t);
  document.getElementById('lula-votes-2t').innerText = formatNumber(lulaVotos2t);
  document.getElementById('flavio-votes-2t').innerText = formatNumber(flavioVotos2t);

  const kpiLula = document.getElementById('kpi-viradas-lula');
  const kpiFlavio = document.getElementById('kpi-viradas-flavio');
  if (kpiLula && data.viradas_flavio_lula !== undefined) {
    kpiLula.innerText = `${formatNumber(data.viradas_flavio_lula)} seções`;
  }
  if (kpiFlavio && data.viradas_lula_flavio !== undefined) {
    kpiFlavio.innerText = `${formatNumber(data.viradas_lula_flavio)} seções`;
  }

  document.getElementById('ratio-pct-lula').innerText = formatPct(lulaPct2t);
  document.getElementById('ratio-pct-flavio').innerText = formatPct(flavioPct2t);
  document.getElementById('ratio-bar-lula').style.width = (lulaPct2t || 50) + '%';
  document.getElementById('ratio-bar-flavio').style.width = (flavioPct2t || 50) + '%';

  const lulaVotos1t = data.lula_votos_1t_mesmas || 53879538;
  const flavioVotos1t = data.flavio_votos_1t_mesmas || 56104503;
  const lulaPct1t = data.lula_pct_1t_mesmas || 45.17;
  const flavioPct1t = data.flavio_pct_1t_mesmas || 47.03;

  const lulaMax = Math.max(lulaVotos1t, lulaVotos2t, 1);
  document.getElementById('lula-bar-fill-1t').style.height = Math.max(16, (lulaVotos1t / lulaMax) * 100) + '%';
  document.getElementById('lula-bar-fill-2t').style.height = Math.max(16, (lulaVotos2t / lulaMax) * 100) + '%';
  document.getElementById('lula-bar-pct-1t').innerText = formatPct(lulaPct1t);
  document.getElementById('lula-bar-pct-2t').innerText = formatPct(lulaPct2t);
  document.getElementById('lula-bar-val-1t').innerText = formatNumber(lulaVotos1t);
  document.getElementById('lula-bar-val-2t').innerText = formatNumber(lulaVotos2t);

  const flavioMax = Math.max(flavioVotos1t, flavioVotos2t, 1);
  document.getElementById('flavio-bar-fill-1t').style.height = Math.max(16, (flavioVotos1t / flavioMax) * 100) + '%';
  document.getElementById('flavio-bar-fill-2t').style.height = Math.max(16, (flavioVotos2t / flavioMax) * 100) + '%';
  document.getElementById('flavio-bar-pct-1t').innerText = formatPct(flavioPct1t);
  document.getElementById('flavio-bar-pct-2t').innerText = formatPct(flavioPct2t);
  document.getElementById('flavio-bar-val-1t').innerText = formatNumber(flavioVotos1t);
  document.getElementById('flavio-bar-val-2t').innerText = formatNumber(flavioVotos2t);

  const deltaLula = data.delta_lula || (lulaVotos2t - lulaVotos1t);
  const deltaFlavio = data.delta_flavio || (flavioVotos2t - flavioVotos1t);
  const pctCrescimentoLula = lulaVotos1t > 0 ? (deltaLula / lulaVotos1t) * 100 : 0;
  const pctCrescimentoFlavio = flavioVotos1t > 0 ? (deltaFlavio / flavioVotos1t) * 100 : 0;

  updateBadge('lula-delta-badge', deltaLula, pctCrescimentoLula);
  updateBadge('flavio-delta-badge', deltaFlavio, pctCrescimentoFlavio);
}

function updateBadge(id, delta, pct) {
  const badge = document.getElementById(id);
  if (!badge) return;
  const sign = delta >= 0 ? '+' : '';
  badge.className = `delta-badge ${delta >= 0 ? 'delta-positive' : 'delta-negative'}`;
  badge.innerText = `${sign}${formatNumber(delta)} (${sign}${formatPct(pct)})`;
}

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
  container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">Carregando dados da Seção ${secao} (Zona ${zona} - ${uf})...</div>`;

  try {
    const res = await fetch(`/api/secao?uf=${uf}&zona=${zona}&secao=${secao}`);
    const data = await res.json();

    if (data.error) {
      container.innerHTML = `<div style="color: #fca5a5; padding: 14px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">⚠️ ${data.error}</div>`;
      return;
    }

    renderCardSecao(data);
  } catch (err) {
    container.innerHTML = `<div style="color: #fca5a5; padding: 14px;">Erro ao consultar seção: ${err.message}</div>`;
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

  let viradaBadge = '';
  if (data.virada === 'Flávio -> Lula') {
    viradaBadge = `<span class="badge-status badge-virada-lula">🔄 VIRADA HISTÓRICA: FLÁVIO ➔ LULA</span>`;
  } else if (data.virada === 'Lula -> Flávio') {
    viradaBadge = `<span class="badge-status badge-virada-flavio">🔄 VIRADA: LULA ➔ FLÁVIO</span>`;
  } else {
    viradaBadge = `<span class="badge-status badge-manteve">Manteve Vencedor (${data.vencedor_2t})</span>`;
  }

  const signLula = data.delta_lula >= 0 ? '+' : '';
  const signFlavio = data.delta_flavio >= 0 ? '+' : '';
  const swingSign = data.swing_lula >= 0 ? '+' : '';

  const bairroText = data.bairro ? ` • Bairro: <strong>${data.bairro}</strong>` : '';
  const localInfo = data.local ? `<div style="margin-top: 4px; font-size: 13px; color: #38bdf8;">🏫 <strong>${data.local}</strong> ${data.endereco ? '— ' + data.endereco : ''}</div>` : '';

  container.innerHTML = `
    <div class="secao-header">
      <div>
        <h3>📍 Seção ${data.secao} • Zona ${data.zona} — ${data.nm_mun} (${data.uf})${bairroText}</h3>
        <span style="font-size: 12px; color: var(--text-dim);">Chave: ${data.chave} • Vencedor 1ºT: <strong>${data.vencedor_1t}</strong> ➔ Vencedor 2ºT: <strong>${data.vencedor_2t}</strong></span>
        ${localInfo}
      </div>
      <div>
        ${viradaBadge}
      </div>
    </div>

    <div class="secao-grid" style="margin-top: 14px;">
      <!-- Caixa Lula -->
      <div class="cand-res-box lula">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="color: #fca5a5;">13 - LULA</h4>
          <span class="delta-badge ${data.delta_lula >= 0 ? 'delta-positive' : 'delta-negative'}">${signLula}${formatNumber(data.delta_lula)} votos</span>
        </div>
        <div class="cand-res-row">
          <span>1º Turno:</span>
          <strong>${formatNumber(data.lula_1t)} votos (${formatPct(data.pct1_lula)})</strong>
        </div>
        <div class="cand-res-row">
          <span>2º Turno:</span>
          <strong style="color: var(--lula-color); font-size: 15px;">${formatNumber(data.lula_2t)} votos (${formatPct(data.pct2_lula)})</strong>
        </div>
        <div class="cand-res-row">
          <span>Swing de Margem:</span>
          <strong style="color: ${data.swing_lula >= 0 ? '#4ade80' : '#f87171'};">${swingSign}${data.swing_lula}%</strong>
        </div>
      </div>

      <!-- Caixa Flávio -->
      <div class="cand-res-box flavio">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="color: #93c5fd;">22 - FLÁVIO BOLSONARO</h4>
          <span class="delta-badge ${data.delta_flavio >= 0 ? 'delta-positive' : 'delta-negative'}">${signFlavio}${formatNumber(data.delta_flavio)} votos</span>
        </div>
        <div class="cand-res-row">
          <span>1º Turno:</span>
          <strong>${formatNumber(data.flavio_1t)} votos (${formatPct(data.pct1_flavio)})</strong>
        </div>
        <div class="cand-res-row">
          <span>2º Turno:</span>
          <strong style="color: var(--flavio-color); font-size: 15px;">${formatNumber(data.flavio_2t)} votos (${formatPct(data.pct2_flavio)})</strong>
        </div>
        <div class="cand-res-row">
          <span>Outros no 1º Turno:</span>
          <span style="color: var(--text-dim);">${formatNumber(data.outros_1t)} votos</span>
        </div>
      </div>
    </div>
  `;
}

async function fetchSecoesComparadas() {
  const viradaSelect = document.getElementById('filter-virada');
  const virada = viradaSelect ? viradaSelect.value : 'viradas';
  const ufSelect = document.getElementById('filter-uf');
  const uf = ufSelect ? ufSelect.value : '';

  const tbody = document.getElementById('table-secoes-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-dim); padding: 24px;">Carregando seções...</td></tr>`;

  try {
    const res = await fetch(`/api/secoes?uf=${uf}&virada=${virada}&limit=60`);
    const secoes = await res.json();

    if (!secoes || secoes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-dim); padding: 24px;">Nenhuma seção encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = secoes.map(s => {
      let badge = '';
      if (s.virada === 'Flávio -> Lula') {
        badge = `<span class="badge-status badge-virada-lula">Flávio ➔ Lula</span>`;
      } else if (s.virada === 'Lula -> Flávio') {
        badge = `<span class="badge-status badge-virada-flavio">Lula ➔ Flávio</span>`;
      } else {
        badge = `<span class="badge-status badge-manteve">Manteve</span>`;
      }

      const signLula = s.delta_lula >= 0 ? '+' : '';
      const deltaClass = s.delta_lula >= 0 ? 'delta-positive' : 'delta-negative';

      return `
        <tr style="cursor: pointer;" onclick="preencherExemplo('${s.uf}', ${s.zona}, ${s.secao})" title="Clique para ver detalhes">
          <td><strong>${s.uf}</strong></td>
          <td>${s.nm_mun}</td>
          <td><small style="color: #38bdf8;">${s.bairro || 'NÃO ESPECIFICADO'}</small></td>
          <td>Z${s.zona} / S${s.secao}</td>
          <td style="color: var(--lula-color); font-weight: 600;">${formatNumber(s.lula_1t)} <small style="color: var(--text-dim);">(${formatPct(s.pct1_lula)})</small></td>
          <td style="color: var(--flavio-color); font-weight: 600;">${formatNumber(s.flavio_1t)} <small style="color: var(--text-dim);">(${formatPct(s.pct1_flavio)})</small></td>
          <td style="color: var(--lula-color); font-weight: 700;">${formatNumber(s.lula_2t)} <small style="color: var(--text-dim);">(${formatPct(s.pct2_lula)})</small></td>
          <td style="color: var(--flavio-color); font-weight: 700;">${formatNumber(s.flavio_2t)} <small style="color: var(--text-dim);">(${formatPct(s.pct2_flavio)})</small></td>
          <td>${s.vencedor_1t}</td>
          <td><strong>${s.vencedor_2t}</strong></td>
          <td>${badge}</td>
          <td><span class="delta-badge ${deltaClass}">${signLula}${formatNumber(s.delta_lula)}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro na tabela de seções:', err);
  }
}

// ==========================================
// ABA 2: DASHBOARD POR CIDADES (MUNICÍPIOS)
// ==========================================
let listaCidadesCache = [];

async function carregarMunicipiosEstado() {
  const uf = document.getElementById('cidades-uf').value;
  const virada = document.getElementById('cidades-filter-virada').value;
  const tbody = document.getElementById('table-cidades-body');
  const title = document.getElementById('cidades-table-title');

  title.innerText = `📋 Cidades de ${uf} (${virada === 'viradas' ? 'Apenas com Virada' : 'Todas'})`;
  tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 24px;">Carregando municípios de ${uf}...</td></tr>`;

  try {
    const res = await fetch(`/api/municipios?uf=${uf}&virada=${virada}&limit=200`);
    listaCidadesCache = await res.json();
    window.cidadesCarregadas = true;

    renderTabelaCidades(listaCidadesCache);

    // Seleciona a primeira cidade como destaque inicial
    if (listaCidadesCache.length > 0) {
      selecionarCidade(listaCidadesCache[0].cod_mun, listaCidadesCache[0].nm_mun);
    }
  } catch (err) {
    console.error('Erro ao buscar municípios:', err);
    tbody.innerHTML = `<tr><td colspan="11" style="color: #fca5a5; text-align: center; padding: 20px;">Falha ao carregar municípios.</td></tr>`;
  }
}

function filtrarCidadesDigitacao() {
  const termo = document.getElementById('cidades-search-input').value.toUpperCase().trim();
  if (!termo) {
    renderTabelaCidades(listaCidadesCache);
    return;
  }
  const filtradas = listaCidadesCache.filter(c => c.nm_mun.includes(termo));
  renderTabelaCidades(filtradas);
}

function renderTabelaCidades(cidades) {
  const tbody = document.getElementById('table-cidades-body');
  if (!cidades || cidades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 24px;">Nenhum município encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = cidades.map(c => {
    let viradaBadge = '<span class="badge-status badge-manteve">Manteve</span>';
    if (c.virada === 'Flávio -> Lula') {
      viradaBadge = '<span class="badge-status badge-virada-lula">Flávio ➔ Lula</span>';
    } else if (c.virada === 'Lula -> Flávio') {
      viradaBadge = '<span class="badge-status badge-virada-flavio">Lula ➔ Flávio</span>';
    }

    const swingSign = c.swing_lula >= 0 ? '+' : '';
    const swingColor = c.swing_lula >= 0 ? '#4ade80' : '#f87171';

    return `
      <tr style="cursor: pointer;" onclick="selecionarCidade(${c.cod_mun}, '${c.nm_mun}')" title="Clique para detalhar esta cidade">
        <td><strong>${c.nm_mun}</strong></td>
        <td>${formatNumber(c.total_secoes)}</td>
        <td style="color: var(--lula-color);">${formatNumber(c.lula_1t)} <small>(${formatPct(c.pct_lula_1t)})</small></td>
        <td style="color: var(--flavio-color);">${formatNumber(c.flavio_1t)} <small>(${formatPct(c.pct_flavio_1t)})</small></td>
        <td style="color: var(--lula-color); font-weight: 700;">${formatNumber(c.lula_2t)} <small>(${formatPct(c.pct_lula_2t)})</small></td>
        <td style="color: var(--flavio-color); font-weight: 700;">${formatNumber(c.flavio_2t)} <small>(${formatPct(c.pct_flavio_2t)})</small></td>
        <td>${c.vencedor_1t}</td>
        <td><strong>${c.vencedor_2t}</strong></td>
        <td>${viradaBadge}</td>
        <td style="font-weight: 700; color: #fbbf24;">${formatNumber(c.viradas_secoes_lula)} urnas</td>
        <td style="color: ${swingColor}; font-weight: 700;">${swingSign}${c.swing_lula}%</td>
      </tr>
    `;
  }).join('');
}

async function selecionarCidade(cod_mun, nome_mun) {
  const uf = document.getElementById('cidades-uf').value;
  const container = document.getElementById('city-highlight-container');

  try {
    const res = await fetch(`/api/municipio?uf=${uf}&cod_mun=${cod_mun}`);
    const data = await res.json();
    if (!data.municipio) return;

    renderCardDestaqueCidade(data.municipio);
  } catch (err) {
    console.error('Erro ao selecionar cidade:', err);
  }
}

function renderCardDestaqueCidade(m) {
  const container = document.getElementById('city-highlight-container');

  const signLula = m.delta_lula >= 0 ? '+' : '';
  const signFlavio = m.delta_flavio >= 0 ? '+' : '';
  const swingSign = m.swing_lula >= 0 ? '+' : '';

  let viradaTag = '';
  if (m.virada === 'Flávio -> Lula') {
    viradaTag = `<span class="badge-status badge-virada-lula" style="font-size: 13px; padding: 4px 10px;">🔄 VIRADA NO MUNICÍPIO: FLÁVIO ➔ LULA</span>`;
  } else if (m.virada === 'Lula -> Flávio') {
    viradaTag = `<span class="badge-status badge-virada-flavio" style="font-size: 13px; padding: 4px 10px;">🔄 VIRADA NO MUNICÍPIO: LULA ➔ FLÁVIO</span>`;
  } else {
    viradaTag = `<span class="badge-status badge-manteve" style="font-size: 13px; padding: 4px 10px;">Vencedor Confirmado: ${m.vencedor_2t}</span>`;
  }

  container.innerHTML = `
    <div class="city-highlight-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800;">📍 ${m.nm_mun} — ${m.uf}</h2>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">
            Total de seções eleitorais apuradas: <strong>${formatNumber(m.total_secoes)} seções</strong> • Votos válidos: <strong>${formatNumber(m.validos_2t)}</strong>
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          ${viradaTag}
          <button class="btn" onclick="selecionarCidadeNoMapa('${m.uf}', ${m.cod_mun})">
            🗺️ Mapa de Bairros
          </button>
          <button class="btn btn-primary" onclick="abrirBairrosDaCidade('${m.uf}', ${m.cod_mun}, '${m.nm_mun}')">
            🏘️ Ver Bairros Desta Cidade ➔
          </button>
        </div>
      </div>

      <div class="city-stats-row">
        <!-- Caixa Lula -->
        <div class="city-stat-box lula">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="color: #fca5a5;">13 - LULA</h4>
            <span class="delta-badge ${m.delta_lula >= 0 ? 'delta-positive' : 'delta-negative'}">${signLula}${formatNumber(m.delta_lula)} votos</span>
          </div>
          <div style="margin: 10px 0; font-size: 24px; font-weight: 900; color: var(--lula-color);">
            ${formatPct(m.pct_lula_2t)} <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">(${formatNumber(m.lula_2t)} votos)</span>
          </div>
          <div style="font-size: 12px; color: var(--text-dim);">
            1º Turno: ${formatNumber(m.lula_1t)} votos (${formatPct(m.pct_lula_1t)})
          </div>
        </div>

        <!-- Caixa Flávio -->
        <div class="city-stat-box flavio">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="color: #93c5fd;">22 - FLÁVIO BOLSONARO</h4>
            <span class="delta-badge ${m.delta_flavio >= 0 ? 'delta-positive' : 'delta-negative'}">${signFlavio}${formatNumber(m.delta_flavio)} votos</span>
          </div>
          <div style="margin: 10px 0; font-size: 24px; font-weight: 900; color: var(--flavio-color);">
            ${formatPct(m.pct_flavio_2t)} <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">(${formatNumber(m.flavio_2t)} votos)</span>
          </div>
          <div style="font-size: 12px; color: var(--text-dim);">
            1º Turno: ${formatNumber(m.flavio_1t)} votos (${formatPct(m.pct_flavio_1t)})
          </div>
        </div>

        <!-- Métrica de Viradas de Urnas -->
        <div class="city-stat-box" style="border-left: 4px solid #f59e0b;">
          <h4 style="color: #fcd34d;">🔄 VIRADAS DE URNAS NA CIDADE</h4>
          <div style="margin: 10px 0; font-size: 24px; font-weight: 900; color: #fbbf24;">
            ${formatNumber(m.viradas_secoes_lula)} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">seções viradas p/ Lula</span>
          </div>
          <div style="font-size: 12px; color: var(--text-dim);">
            Swing de Margem pró-Lula: <strong>${swingSign}${m.swing_lula}%</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// ABA 3: DASHBOARD POR BAIRROS & ESCOLAS
// ==========================================
async function atualizarCidadesSelectBairros(cidadePreSelecionada) {
  const uf = document.getElementById('bairros-uf').value;
  const select = document.getElementById('bairros-cidade-select');

  select.innerHTML = `<option value="">Carregando cidades de ${uf}...</option>`;

  try {
    const res = await fetch(`/api/municipios?uf=${uf}&limit=300`);
    const cidades = await res.json();

    select.innerHTML = cidades.map(c => 
      `<option value="${c.cod_mun}" data-nome="${c.nm_mun}">${c.nm_mun} (${formatNumber(c.total_secoes)} seções)</option>`
    ).join('');

    if (cidadePreSelecionada) {
      select.value = cidadePreSelecionada;
    }

    window.bairrosCarregados = true;
    carregarBairrosCidade();
  } catch (err) {
    console.error('Erro ao carregar cidades para bairros:', err);
  }
}

async function carregarBairrosCidade() {
  const uf = document.getElementById('bairros-uf').value;
  const select = document.getElementById('bairros-cidade-select');
  const cod_mun = select.value;
  const sort = document.getElementById('bairros-sort').value;

  if (!cod_mun) return;

  const nome_mun = select.options[select.selectedIndex]?.getAttribute('data-nome') || '';

  document.getElementById('bairros-table-title').innerText = `📍 Bairros de ${nome_mun} (${uf})`;
  document.getElementById('escolas-table-title').innerText = `🏫 Principais Colégios e Locais de Votação de ${nome_mun} (${uf})`;

  const tbodyBairros = document.getElementById('table-bairros-body');
  const tbodyEscolas = document.getElementById('table-escolas-body');

  tbodyBairros.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 20px;">Carregando bairros...</td></tr>`;
  tbodyEscolas.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 20px;">Carregando escolas...</td></tr>`;

  try {
    const [resMun, resBairros] = await Promise.all([
      fetch(`/api/municipio?uf=${uf}&cod_mun=${cod_mun}`),
      fetch(`/api/bairros?uf=${uf}&cod_mun=${cod_mun}&sort=${sort}&limit=1000`)
    ]);

    const dataMun = await resMun.json();
    const bairros = await resBairros.json();

    window.dadosCidadeBairrosAtual = {
      municipio: dataMun.municipio || { uf, cod_mun, nm_mun: nome_mun },
      bairros: bairros || [],
      locais: dataMun.locais || []
    };

    const inlineMapTitle = document.getElementById('bairros-inline-map-title');
    if (inlineMapTitle) {
      inlineMapTitle.innerText = `🗺️ Mapa de Bairros e Colégios Eleitorais — ${nome_mun} (${uf})`;
    }

    limparFiltroBairroEscolas(true);
    renderBairrosKPICards(bairros, nome_mun);
    renderTabelaBairros(bairros);
    renderTabelaEscolas(dataMun.locais || []);
    renderElectoralMap('inline', window.dadosCidadeBairrosAtual);
  } catch (err) {
    console.error('Erro ao carregar dados de bairros:', err);
  }
}

function renderBairrosKPICards(bairros, nome_mun) {
  const container = document.getElementById('bairros-kpi-container');
  if (!bairros || bairros.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Encontra bairro mais lulista, mais bolsonarista e com mais viradas
  const ordenadosLula = [...bairros].sort((a, b) => b.pct_lula_2t - a.pct_lula_2t);
  const ordenadosFlavio = [...bairros].sort((a, b) => b.pct_flavio_2t - a.pct_flavio_2t);
  const ordenadosViradas = [...bairros].sort((a, b) => b.viradas_lula - a.viradas_lula);

  const topLula = ordenadosLula[0];
  const topFlavio = ordenadosFlavio[0];
  const topViradas = ordenadosViradas[0];

  container.innerHTML = `
    <div class="kpi-card" style="border-left: 4px solid var(--lula-color);">
      <span class="kpi-label">🔴 Bairro Mais Votado para Lula</span>
      <div class="kpi-val" style="color: var(--lula-color); font-size: 20px;">${topLula.bairro}</div>
      <span class="kpi-sub">${formatPct(topLula.pct_lula_2t)} dos votos válidos (${formatNumber(topLula.lula_2t)} votos)</span>
    </div>

    <div class="kpi-card" style="border-left: 4px solid var(--flavio-color);">
      <span class="kpi-label">🔵 Bairro Mais Votado para Flávio</span>
      <div class="kpi-val" style="color: var(--flavio-color); font-size: 20px;">${topFlavio.bairro}</div>
      <span class="kpi-sub">${formatPct(topFlavio.pct_flavio_2t)} dos votos válidos (${formatNumber(topFlavio.flavio_2t)} votos)</span>
    </div>

    <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
      <span class="kpi-label">🔄 Bairro com Mais Viradas de Urnas</span>
      <div class="kpi-val" style="color: #fbbf24; font-size: 20px;">${topViradas.bairro}</div>
      <span class="kpi-sub">${formatNumber(topViradas.viradas_lula)} urnas viraram de Flávio para Lula</span>
    </div>

    <div class="kpi-card">
      <span class="kpi-label">📍 Total de Bairros Mapeados</span>
      <div class="kpi-val" style="color: #38bdf8; font-size: 20px;">${formatNumber(bairros.length)} Bairros</div>
      <span class="kpi-sub">Detalhamento nominal oficial em ${nome_mun}</span>
    </div>
  `;
}

function renderTabelaBairros(bairros) {
  const tbody = document.getElementById('table-bairros-body');
  if (!bairros || bairros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-dim); padding: 20px;">Nenhum bairro registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = bairros.map(b => {
    let viradaBadge = '<span class="badge-status badge-manteve">Manteve</span>';
    if (b.virada === 'Flávio -> Lula') {
      viradaBadge = '<span class="badge-status badge-virada-lula">Flávio ➔ Lula</span>';
    } else if (b.virada === 'Lula -> Flávio') {
      viradaBadge = '<span class="badge-status badge-virada-flavio">Lula ➔ Flávio</span>';
    }

    const swingSign = b.swing_lula >= 0 ? '+' : '';
    const swingColor = b.swing_lula >= 0 ? '#4ade80' : '#f87171';

    const safeBairro = (b.bairro || '').replace(/'/g, "\\'");

    return `
      <tr style="cursor: pointer;" onclick="focarBairroEFiltrarEscolas('${safeBairro}')" title="Clique para localizar este bairro no mapa e filtrar suas escolas">
        <td><strong>📍 ${b.bairro}</strong></td>
        <td>${formatNumber(b.total_secoes)}</td>
        <td style="color: var(--lula-color);">${formatNumber(b.lula_1t)} <small>(${formatPct(b.pct_lula_1t)})</small></td>
        <td style="color: var(--flavio-color);">${formatNumber(b.flavio_1t)} <small>(${formatPct(b.pct_flavio_1t)})</small></td>
        <td style="color: var(--lula-color); font-weight: 700;">${formatNumber(b.lula_2t)} <small>(${formatPct(b.pct_lula_2t)})</small></td>
        <td style="color: var(--flavio-color); font-weight: 700;">${formatNumber(b.flavio_2t)} <small>(${formatPct(b.pct_flavio_2t)})</small></td>
        <td>${b.vencedor_1t}</td>
        <td><strong>${b.vencedor_2t}</strong></td>
        <td>${viradaBadge}</td>
        <td style="font-weight: 700; color: #fbbf24;">${formatNumber(b.viradas_lula)} urnas</td>
        <td style="color: ${swingColor}; font-weight: 700;">${swingSign}${b.swing_lula}%</td>
      </tr>
    `;
  }).join('');
}

function focarBairroEFiltrarEscolas(nomeBairro) {
  if (!window.dadosCidadeBairrosAtual) return;
  const todosLocais = window.dadosCidadeBairrosAtual.locais || [];
  const filtrados = todosLocais.filter(l => l.bairro === nomeBairro);
  renderTabelaEscolas(filtrados);

  const badge = document.getElementById('escolas-filter-badge');
  const btnLimpar = document.getElementById('btn-limpar-filtro-bairro');
  if (badge) {
    badge.style.display = 'inline-block';
    badge.innerText = `Filtrado: ${nomeBairro} (${filtrados.length} locais)`;
  }
  if (btnLimpar) {
    btnLimpar.style.display = 'inline-flex';
  }

  zoomParaBairroNoMapa('inline', nomeBairro);
}

function limparFiltroBairroEscolas(silencioso) {
  const badge = document.getElementById('escolas-filter-badge');
  const btnLimpar = document.getElementById('btn-limpar-filtro-bairro');
  if (badge) badge.style.display = 'none';
  if (btnLimpar) btnLimpar.style.display = 'none';

  if (!silencioso && window.dadosCidadeBairrosAtual) {
    renderTabelaEscolas(window.dadosCidadeBairrosAtual.locais || []);
  }
}

function abrirCidadeNaAbaMapaAtual() {
  const uf = document.getElementById('bairros-uf').value;
  const cod_mun = document.getElementById('bairros-cidade-select').value;
  if (uf && cod_mun) {
    selecionarCidadeNoMapa(uf, Number(cod_mun));
  } else {
    switchTab('tab-mapa');
  }
}

// ==========================================
// MOTOR GEOGRÁFICO: MAPA DE BAIRROS & VORONOI
// ==========================================
const mapInstances = {
  inline: {
    containerId: 'bairros-map-canvas',
    legendId: 'inline-map-legend',
    map: null,
    layerGroupVoronoi: null,
    layerGroupBubbles: null,
    layerGroupSchools: null,
    mode: '2t',
    layers: { voronoi: true, bubbles: true, schools: false },
    payload: null,
    bairrosIndex: {}
  },
  full: {
    containerId: 'full-map-canvas',
    legendId: 'full-map-legend',
    map: null,
    layerGroupVoronoi: null,
    layerGroupBubbles: null,
    layerGroupSchools: null,
    mode: '2t',
    layers: { voronoi: true, bubbles: true, schools: true },
    payload: null,
    bairrosIndex: {}
  }
};

function ensureLeafletMap(targetKey) {
  const inst = mapInstances[targetKey];
  if (!inst || !window.L) return null;

  if (!inst.map) {
    const el = document.getElementById(inst.containerId);
    if (!el) return null;

    inst.map = L.map(el, {
      center: [-23.5505, -46.6333],
      zoom: 11,
      zoomControl: true,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO • Dados Oficiais TSE',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(inst.map);

    inst.layerGroupVoronoi = L.layerGroup().addTo(inst.map);
    inst.layerGroupBubbles = L.layerGroup().addTo(inst.map);
    inst.layerGroupSchools = L.layerGroup();
    if (inst.layers.schools) {
      inst.layerGroupSchools.addTo(inst.map);
    }

    // Auto-exibir escolas quando o usuário der bastante zoom no mapa inline
    inst.map.on('zoomend', () => {
      const z = inst.map.getZoom();
      if (targetKey === 'inline' && z >= 14 && !inst.layers.schools) {
        inst.layers.schools = true;
        const btn = document.getElementById('inline-layer-schools');
        if (btn) btn.classList.add('active');
        inst.layerGroupSchools.addTo(inst.map);
      }
    });
  }
  return inst;
}

function getBairroStyle(b, mode) {
  if (mode === '1t') {
    const isLula = b.lula_1t > b.flavio_1t;
    const isFlavio = b.flavio_1t > b.lula_1t;
    const diff = Math.abs((b.pct_lula_1t || 0) - (b.pct_flavio_1t || 0));
    if (isLula) {
      if (diff >= 22) return { fill: '#b91c1c', stroke: '#f87171', fillOpacity: 0.48 };
      if (diff >= 10) return { fill: '#dc2626', stroke: '#fca5a5', fillOpacity: 0.40 };
      return { fill: '#ef4444', stroke: '#fecaca', fillOpacity: 0.32 };
    }
    if (isFlavio) {
      if (diff >= 22) return { fill: '#1d4ed8', stroke: '#60a5fa', fillOpacity: 0.48 };
      if (diff >= 10) return { fill: '#2563eb', stroke: '#93c5fd', fillOpacity: 0.40 };
      return { fill: '#3b82f6', stroke: '#bfdbfe', fillOpacity: 0.32 };
    }
    return { fill: '#64748b', stroke: '#94a3b8', fillOpacity: 0.30 };
  }

  if (mode === 'viradas') {
    if (b.virada === 'Flávio -> Lula') {
      return { fill: '#f59e0b', stroke: '#fde047', fillOpacity: 0.62 };
    }
    if (b.virada === 'Lula -> Flávio') {
      return { fill: '#06b6d4', stroke: '#67e8f9', fillOpacity: 0.62 };
    }
    if ((b.viradas_lula || 0) > 0) {
      return { fill: '#ea580c', stroke: '#fdba74', fillOpacity: 0.38 };
    }
    return { fill: '#1e293b', stroke: '#475569', fillOpacity: 0.20 };
  }

  // Default: '2t'
  const isLula = b.lula_2t > b.flavio_2t;
  const isFlavio = b.flavio_2t > b.lula_2t;
  const diff = Math.abs((b.pct_lula_2t || 0) - (b.pct_flavio_2t || 0));
  if (isLula) {
    if (diff >= 22) return { fill: '#b91c1c', stroke: '#f87171', fillOpacity: 0.48 };
    if (diff >= 10) return { fill: '#dc2626', stroke: '#fca5a5', fillOpacity: 0.40 };
    return { fill: '#ef4444', stroke: '#fecaca', fillOpacity: 0.32 };
  }
  if (isFlavio) {
    if (diff >= 22) return { fill: '#1d4ed8', stroke: '#60a5fa', fillOpacity: 0.48 };
    if (diff >= 10) return { fill: '#2563eb', stroke: '#93c5fd', fillOpacity: 0.40 };
    return { fill: '#3b82f6', stroke: '#bfdbfe', fillOpacity: 0.32 };
  }
  return { fill: '#64748b', stroke: '#94a3b8', fillOpacity: 0.30 };
}

// Algoritmo Sutherland-Hodgman para recortar cada polígono de Voronoi em um raio urbano orgânico
function clipPolygonWithCircle(polyCoords, centerLng, centerLat, radiusDeg) {
  if (!polyCoords || polyCoords.length < 3) return polyCoords;
  const steps = 16;
  let outputList = polyCoords.slice(0, polyCoords.length - 1); // remove último ponto duplicado

  for (let i = 0; i < steps; i++) {
    const a1 = (2 * Math.PI * i) / steps;
    const a2 = (2 * Math.PI * (i + 1)) / steps;
    const x1 = centerLng + radiusDeg * Math.cos(a1);
    const y1 = centerLat + radiusDeg * Math.sin(a1);
    const x2 = centerLng + radiusDeg * Math.cos(a2);
    const y2 = centerLat + radiusDeg * Math.sin(a2);

    const inputList = outputList;
    outputList = [];
    if (inputList.length === 0) break;

    let S = inputList[inputList.length - 1];
    for (let j = 0; j < inputList.length; j++) {
      const E = inputList[j];
      const insideE = (x2 - x1) * (E[1] - y1) - (y2 - y1) * (E[0] - x1) >= 0;
      const insideS = (x2 - x1) * (S[1] - y1) - (y2 - y1) * (S[0] - x1) >= 0;

      if (insideE) {
        if (!insideS) {
          const inter = intersectSegments(S[0], S[1], E[0], E[1], x1, y1, x2, y2);
          if (inter) outputList.push(inter);
        }
        outputList.push(E);
      } else if (insideS) {
        const inter = intersectSegments(S[0], S[1], E[0], E[1], x1, y1, x2, y2);
        if (inter) outputList.push(inter);
      }
      S = E;
    }
  }
  return outputList;
}

function intersectSegments(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) return null;
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
  return [px, py];
}

function createCirclePolygon(centerLng, centerLat, radiusDeg) {
  const pts = [];
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    pts.push([centerLat + radiusDeg * Math.sin(a), centerLng + radiusDeg * Math.cos(a)]);
  }
  return pts;
}

function buildBairroPopupHTML(b, targetKey) {
  const signDeltaL = (b.delta_lula || 0) >= 0 ? '+' : '';
  const signSwing = (b.swing_lula || 0) >= 0 ? '+' : '';
  let viradaHtml = `<span class="badge-status badge-manteve">Manteve (${b.vencedor_2t})</span>`;
  if (b.virada === 'Flávio -> Lula') {
    viradaHtml = `<span class="badge-status badge-virada-lula">🔄 VIRADA NO BAIRRO: FLÁVIO ➔ LULA</span>`;
  } else if (b.virada === 'Lula -> Flávio') {
    viradaHtml = `<span class="badge-status badge-virada-flavio">🔄 VIRADA NO BAIRRO: LULA ➔ FLÁVIO</span>`;
  }

  return `
    <div style="min-width: 250px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px;">
        <strong style="font-size: 14px; color: #f8fafc;">🏘️ ${b.bairro}</strong>
        <span style="font-size: 11px; color: #38bdf8; font-weight: 700;">${formatNumber(b.total_secoes)} seções</span>
      </div>
      <div style="margin-bottom: 8px;">${viradaHtml}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; background: rgba(0,0,0,0.35); padding: 8px; border-radius: 8px;">
        <div>
          <div style="color: #fca5a5; font-weight: 700;">13 - LULA</div>
          <div>2ºT: <strong>${formatPct(b.pct_lula_2t)}</strong> (${formatNumber(b.lula_2t)})</div>
          <div style="color: #94a3b8; font-size: 11px;">1ºT: ${formatPct(b.pct_lula_1t)} (${formatNumber(b.lula_1t)})</div>
        </div>
        <div>
          <div style="color: #93c5fd; font-weight: 700;">22 - FLÁVIO</div>
          <div>2ºT: <strong>${formatPct(b.pct_flavio_2t)}</strong> (${formatNumber(b.flavio_2t)})</div>
          <div style="color: #94a3b8; font-size: 11px;">1ºT: ${formatPct(b.pct_flavio_1t)} (${formatNumber(b.flavio_1t)})</div>
        </div>
      </div>
      <div style="margin-top: 8px; display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1;">
        <span>Urnas viradas p/ Lula: <strong style="color: #fbbf24;">${formatNumber(b.viradas_lula || 0)}</strong></span>
        <span>Swing: <strong style="color: ${(b.swing_lula || 0) >= 0 ? '#4ade80' : '#f87171'};">${signSwing}${b.swing_lula}%</strong></span>
      </div>
    </div>
  `;
}

function renderMapLegend(targetKey) {
  const inst = mapInstances[targetKey];
  const el = document.getElementById(inst.legendId);
  if (!el) return;

  if (inst.mode === 'viradas') {
    el.innerHTML = `
      <div class="legend-group">
        <span style="font-weight: 800; color: #f8fafc;">LEGENDA (MAPA DE VIRADAS 1ºT ➔ 2ºT):</span>
        <span class="legend-item"><i class="legend-swatch" style="background: #f59e0b;"></i> Bairro Virou Flávio ➔ Lula</span>
        <span class="legend-item"><i class="legend-swatch" style="background: #ea580c;"></i> Possui Urnas/Escolas Viradas p/ Lula</span>
        <span class="legend-item"><i class="legend-swatch" style="background: #06b6d4;"></i> Bairro Virou Lula ➔ Flávio</span>
        <span class="legend-item"><i class="legend-swatch" style="background: #1e293b;"></i> Sem Virada de Urnas</span>
      </div>
      <div style="font-size: 11px;">💡 Clique em um bairro ou escola para inspecionar</div>
    `;
    return;
  }

  const labelTurno = inst.mode === '1t' ? '1º TURNO' : '2º TURNO';
  el.innerHTML = `
    <div class="legend-group">
      <span style="font-weight: 800; color: #f8fafc;">LEGENDA (${labelTurno}):</span>
      <span class="legend-item"><i class="legend-swatch" style="background: #b91c1c;"></i> Lula Forte (>60%)</span>
      <span class="legend-item"><i class="legend-swatch" style="background: #ef4444;"></i> Lula Venceu (50–60%)</span>
      <span class="legend-item"><i class="legend-swatch" style="background: #3b82f6;"></i> Flávio Venceu (50–60%)</span>
      <span class="legend-item"><i class="legend-swatch" style="background: #1d4ed8;"></i> Flávio Forte (>60%)</span>
    </div>
    <div style="font-size: 11px;">⭕ Tamanho da bolha = Total de Seções do Bairro • 🏫 Pinos = Escolas</div>
  `;
}

function renderElectoralMap(targetKey, payload, preserveView) {
  const inst = ensureLeafletMap(targetKey);
  if (!inst || !payload) return;

  inst.payload = payload;
  inst.layerGroupVoronoi.clearLayers();
  inst.layerGroupBubbles.clearLayers();
  inst.layerGroupSchools.clearLayers();
  inst.bairrosIndex = {};

  renderMapLegend(targetKey);

  const rawBairros = (payload.bairros || []).filter(
    b => b.lat !== null && b.lng !== null && !isNaN(b.lat) && !isNaN(b.lng)
  );

  if (rawBairros.length === 0) {
    return;
  }

  // Filtra eventuais outliers de GPS fora do perímetro urbano da cidade
  const sortedLats = rawBairros.map(b => Number(b.lat)).sort((a, b) => a - b);
  const sortedLngs = rawBairros.map(b => Number(b.lng)).sort((a, b) => a - b);
  const medLat = sortedLats[Math.floor(sortedLats.length / 2)];
  const medLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

  const seenCoords = new Set();
  const validBairros = [];

  rawBairros.forEach((b, idx) => {
    let lat = Number(b.lat);
    let lng = Number(b.lng);
    if (Math.abs(lat - medLat) > 0.55 || Math.abs(lng - medLng) > 0.55) {
      return;
    }
    // Desempata coordenadas idênticas com micro-offset espiral (~60m) para malha de Voronoi perfeita
    let key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
    let attempt = 1;
    while (seenCoords.has(key)) {
      const angle = attempt * 1.1;
      const r = 0.0006 * attempt;
      lat += r * Math.sin(angle);
      lng += r * Math.cos(angle);
      key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      attempt++;
    }
    seenCoords.add(key);
    const enriched = { ...b, latClean: lat, lngClean: lng };
    validBairros.push(enriched);
    inst.bairrosIndex[b.bairro] = enriched;
  });

  if (validBairros.length === 0) return;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let maxSecoes = 1;
  validBairros.forEach(b => {
    if (b.latClean < minLat) minLat = b.latClean;
    if (b.latClean > maxLat) maxLat = b.latClean;
    if (b.lngClean < minLng) minLng = b.lngClean;
    if (b.lngClean > maxLng) maxLng = b.lngClean;
    if (b.total_secoes > maxSecoes) maxSecoes = b.total_secoes;
  });

  const spanLat = Math.max(0.015, maxLat - minLat);
  const spanLng = Math.max(0.015, maxLng - minLng);
  const maxSpan = Math.max(spanLat, spanLng);
  const pad = Math.max(0.02, maxSpan * 0.25);

  // Raio máximo orgânico de cada território de bairro (evita polígonos infinitos nas bordas)
  const cellRadiusDeg = Math.max(0.010, Math.min(0.048, (maxSpan / Math.sqrt(validBairros.length)) * 1.35));

  // 1. Camada de Polígonos de Território por Bairro (Voronoi recortado)
  if (validBairros.length >= 3 && window.d3 && d3.Delaunay) {
    const delaunay = d3.Delaunay.from(validBairros, b => b.lngClean, b => b.latClean);
    const voronoi = delaunay.voronoi([minLng - pad, minLat - pad, maxLng + pad, maxLat + pad]);

    validBairros.forEach((b, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;
      const clipped = clipPolygonWithCircle(cell, b.lngClean, b.latClean, cellRadiusDeg);
      if (!clipped || clipped.length < 3) return;

      const latLngs = clipped.map(pt => [pt[1], pt[0]]);
      const st = getBairroStyle(b, inst.mode);

      const poly = L.polygon(latLngs, {
        color: st.stroke,
        weight: b.virada !== 'Não' && inst.mode === 'viradas' ? 2.2 : 1.2,
        opacity: 0.75,
        fillColor: st.fill,
        fillOpacity: st.fillOpacity
      });

      poly.bindTooltip(
        `<strong>${b.bairro}</strong><br>` +
        `2ºT: <span style="color:#fca5a5;">Lula ${formatPct(b.pct_lula_2t)}</span> vs <span style="color:#93c5fd;">Flávio ${formatPct(b.pct_flavio_2t)}</span><br>` +
        `1ºT: Lula ${formatPct(b.pct_lula_1t)} vs Flávio ${formatPct(b.pct_flavio_1t)} • ${b.total_secoes} seções`,
        { sticky: true, className: 'bairro-map-tooltip' }
      );

      poly.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: Math.min(0.75, st.fillOpacity + 0.2) });
      });
      poly.on('mouseout', function () {
        this.setStyle({ weight: b.virada !== 'Não' && inst.mode === 'viradas' ? 2.2 : 1.2, fillOpacity: st.fillOpacity });
      });
      poly.on('click', () => {
        aoClicarBairroNoMapa(targetKey, b);
      });

      inst.layerGroupVoronoi.addLayer(poly);
    });
  } else {
    // Cidades com 1 ou 2 bairros
    validBairros.forEach(b => {
      const latLngs = createCirclePolygon(b.lngClean, b.latClean, cellRadiusDeg);
      const st = getBairroStyle(b, inst.mode);
      const poly = L.polygon(latLngs, {
        color: st.stroke,
        weight: 1.5,
        opacity: 0.8,
        fillColor: st.fill,
        fillOpacity: st.fillOpacity
      });
      poly.on('click', () => aoClicarBairroNoMapa(targetKey, b));
      inst.layerGroupVoronoi.addLayer(poly);
    });
  }

  // 2. Camada de Bolhas Proporcionais por Bairro + Rótulos dos Maiores Bairros
  validBairros.forEach((b, idx) => {
    const st = getBairroStyle(b, inst.mode);
    const radiusPx = Math.max(5, Math.min(24, 4 + Math.sqrt(b.total_secoes / maxSecoes) * 18));

    const bubble = L.circleMarker([b.latClean, b.lngClean], {
      radius: radiusPx,
      color: '#ffffff',
      weight: b.virada !== 'Não' ? 2 : 1,
      fillColor: st.fill,
      fillOpacity: 0.88
    });

    bubble.bindPopup(buildBairroPopupHTML(b, targetKey));
    bubble.on('click', () => {
      aoClicarBairroNoMapa(targetKey, b);
    });

    // Rótulo fixo discreto nos 15 maiores bairros da cidade
    if (idx < 15) {
      bubble.bindTooltip(b.bairro, {
        permanent: true,
        direction: 'top',
        offset: [0, -radiusPx - 2],
        className: 'bairro-label-permanent'
      });
    }

    inst.layerGroupBubbles.addLayer(bubble);
  });

  // 3. Camada de Pinos das Escolas / Colégios Eleitorais
  const locais = (payload.locais || []).filter(
    l => l.lat !== null && l.lng !== null && !isNaN(l.lat) && !isNaN(l.lng) &&
         Math.abs(Number(l.lat) - medLat) <= 0.55 && Math.abs(Number(l.lng) - medLng) <= 0.55
  );

  locais.forEach(loc => {
    let fillSchool = loc.vencedor_2t === 'Lula' ? '#ef4444' : '#3b82f6';
    if (inst.mode === '1t') {
      fillSchool = loc.vencedor_1t === 'Lula' ? '#ef4444' : '#3b82f6';
    } else if (inst.mode === 'viradas') {
      if (loc.virada_local === 'Flávio -> Lula' || (loc.viradas_lula || 0) > 0) {
        fillSchool = '#fbbf24';
      } else if (loc.virada_local === 'Lula -> Flávio') {
        fillSchool = '#06b6d4';
      } else {
        fillSchool = '#475569';
      }
    }

    const schoolMarker = L.circleMarker([Number(loc.lat), Number(loc.lng)], {
      radius: Math.max(4, Math.min(9, 3 + Math.sqrt(loc.secoes || 1))),
      color: '#0f172a',
      weight: 1.5,
      fillColor: fillSchool,
      fillOpacity: 0.95
    });

    schoolMarker.bindPopup(`
      <div style="min-width: 230px;">
        <div style="font-size: 13px; font-weight: 800; color: #38bdf8; margin-bottom: 2px;">🏫 ${loc.local}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Bairro: <strong>${loc.bairro}</strong> • ${loc.secoes} urnas<br>${loc.endereco || ''}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; background: rgba(0,0,0,0.4); padding: 7px; border-radius: 6px;">
          <div>
            <span style="color:#fca5a5; font-weight:700;">Lula 2ºT:</span><br>
            <strong>${formatPct(loc.pct_lula_2t)}</strong> (${formatNumber(loc.lula_2t)})
          </div>
          <div>
            <span style="color:#93c5fd; font-weight:700;">Flávio 2ºT:</span><br>
            <strong>${formatPct(loc.pct_flavio_2t)}</strong> (${formatNumber(loc.flavio_2t)})
          </div>
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: #fbbf24; font-weight: 700;">
          ${loc.viradas > 0 ? `🔄 ${loc.viradas} seção(ões) viraram nesta escola` : 'Manteve tendência nas urnas'}
        </div>
      </div>
    `);

    inst.layerGroupSchools.addLayer(schoolMarker);
  });

  if (!preserveView) {
    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    inst.map.fitBounds(bounds.pad(0.08), { maxZoom: 14 });
    setTimeout(() => inst.map.invalidateSize(), 120);
  }
}

function setMapMode(targetKey, mode) {
  const inst = mapInstances[targetKey];
  if (!inst) return;
  inst.mode = mode;

  ['2t', '1t', 'viradas'].forEach(m => {
    const btn = document.getElementById(`${targetKey}-mode-${m}`);
    if (btn) btn.classList.toggle('active', m === mode);
  });

  if (inst.payload) {
    renderElectoralMap(targetKey, inst.payload, true);
  }
}

function toggleMapLayer(targetKey, layerName) {
  const inst = mapInstances[targetKey];
  if (!inst || !inst.map) return;

  inst.layers[layerName] = !inst.layers[layerName];
  const btn = document.getElementById(`${targetKey}-layer-${layerName}`);
  if (btn) btn.classList.toggle('active', inst.layers[layerName]);

  const groupMap = {
    voronoi: inst.layerGroupVoronoi,
    bubbles: inst.layerGroupBubbles,
    schools: inst.layerGroupSchools
  };
  const group = groupMap[layerName];
  if (!group) return;

  if (inst.layers[layerName]) {
    group.addTo(inst.map);
  } else {
    inst.map.removeLayer(group);
  }
}

function aoClicarBairroNoMapa(targetKey, bairroObj) {
  if (targetKey === 'inline') {
    focarBairroEFiltrarEscolas(bairroObj.bairro);
  } else if (targetKey === 'full') {
    renderInspectorBairro(bairroObj);
  }
}

function zoomParaBairroNoMapa(targetKey, nomeBairro) {
  const inst = mapInstances[targetKey];
  if (!inst || !inst.map) return;
  const b = inst.bairrosIndex[nomeBairro];
  if (b) {
    inst.map.flyTo([b.latClean, b.lngClean], 14, { duration: 0.6 });
  }
}

// ==========================================
// ABA 4: MAPA ELEITORAL DEDICADO + INSPETOR
// ==========================================
async function atualizarCidadesSelectMapa(cidadePreSelecionada) {
  const uf = document.getElementById('mapa-uf').value;
  const select = document.getElementById('mapa-cidade-select');

  select.innerHTML = `<option value="">Carregando cidades de ${uf}...</option>`;

  try {
    const res = await fetch(`/api/municipios?uf=${uf}&limit=900`);
    const cidades = await res.json();

    select.innerHTML = cidades.map(c =>
      `<option value="${c.cod_mun}" data-nome="${c.nm_mun}">${c.nm_mun} (${formatNumber(c.total_secoes)} seções)</option>`
    ).join('');

    if (cidadePreSelecionada) {
      select.value = String(cidadePreSelecionada);
    }

    window.mapaDedicadoCarregado = true;
    await carregarMapaDedicado();
  } catch (err) {
    console.error('Erro ao carregar cidades na aba de mapa:', err);
  }
}

async function carregarMapaDedicado() {
  const uf = document.getElementById('mapa-uf').value;
  const select = document.getElementById('mapa-cidade-select');
  const cod_mun = select.value;
  if (!cod_mun) return;

  try {
    const res = await fetch(`/api/municipio?uf=${uf}&cod_mun=${cod_mun}`);
    const data = await res.json();
    if (!data.municipio) return;

    window.dadosMapaDedicadoAtual = data;
    renderElectoralMap('full', data, false);
    renderInspectorResumoCidade(data);
  } catch (err) {
    console.error('Erro ao carregar mapa dedicado da cidade:', err);
  }
}

function resetarZoomMapaDedicado() {
  if (window.dadosMapaDedicadoAtual) {
    renderElectoralMap('full', window.dadosMapaDedicadoAtual, false);
    renderInspectorResumoCidade(window.dadosMapaDedicadoAtual);
  }
}

function selecionarCidadeNoMapa(uf, cod_mun) {
  switchTab('tab-mapa');
  const ufSelect = document.getElementById('mapa-uf');
  if (ufSelect.value !== uf || !window.mapaDedicadoCarregado) {
    ufSelect.value = uf;
    atualizarCidadesSelectMapa(cod_mun);
  } else {
    document.getElementById('mapa-cidade-select').value = String(cod_mun);
    carregarMapaDedicado();
  }
}

function buscarBairroNoMapaInput() {
  const termo = (document.getElementById('mapa-busca-bairro').value || '').toUpperCase().trim();
  const inst = mapInstances.full;
  if (!termo || !inst || !inst.payload) return;

  const encontrado = (inst.payload.bairros || []).find(b => b.bairro.includes(termo));
  if (encontrado && inst.bairrosIndex[encontrado.bairro]) {
    const b = inst.bairrosIndex[encontrado.bairro];
    inst.map.flyTo([b.latClean, b.lngClean], 14, { duration: 0.5 });
    renderInspectorBairro(b);
  }
}

function renderInspectorResumoCidade(data) {
  const m = data.municipio;
  const bairros = data.bairros || [];
  const titleEl = document.getElementById('map-inspector-title');
  const bodyEl = document.getElementById('map-inspector-body');
  if (!titleEl || !bodyEl || !m) return;

  titleEl.innerText = `🏙️ Visão Geral: ${m.nm_mun} (${m.uf})`;

  const bairrosLula2t = bairros.filter(b => b.vencedor_2t === 'Lula').length;
  const bairrosFlavio2t = bairros.filter(b => b.vencedor_2t === 'Flávio').length;
  const bairrosVirados = bairros.filter(b => b.virada !== 'Não').length;

  const topBairros = bairros.slice(0, 12);

  bodyEl.innerHTML = `
    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
      Clique em qualquer polígono de bairro no mapa ao lado para abrir o raio-x das escolas daquele bairro.
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
      <div class="cand-res-box lula" style="padding: 10px;">
        <div style="font-size: 11px; color: #fca5a5; font-weight: 700;">13 - LULA (2ºT)</div>
        <div style="font-size: 20px; font-weight: 900; color: var(--lula-color);">${formatPct(m.pct_lula_2t)}</div>
        <div style="font-size: 11px; color: var(--text-dim);">Venceu em <strong>${bairrosLula2t} bairros</strong></div>
      </div>
      <div class="cand-res-box flavio" style="padding: 10px;">
        <div style="font-size: 11px; color: #93c5fd; font-weight: 700;">22 - FLÁVIO (2ºT)</div>
        <div style="font-size: 20px; font-weight: 900; color: var(--flavio-color);">${formatPct(m.pct_flavio_2t)}</div>
        <div style="font-size: 11px; color: var(--text-dim);">Venceu em <strong>${bairrosFlavio2t} bairros</strong></div>
      </div>
    </div>

    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px; font-size: 12px; margin-bottom: 14px;">
      🔄 <strong>${bairrosVirados} bairros</strong> mudaram de vencedor entre o 1ºT e o 2ºT, totalizando <strong style="color: #fbbf24;">${formatNumber(m.viradas_secoes_lula)} urnas viradas pró-Lula</strong>.
    </div>

    <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
      📍 Principais Bairros (Clique para focar no mapa):
    </div>

    <div class="inspector-school-list">
      ${topBairros.map(b => {
        const safeName = (b.bairro || '').replace(/'/g, "\\'");
        const corVenc = b.vencedor_2t === 'Lula' ? 'var(--lula-color)' : 'var(--flavio-color)';
        return `
          <div class="inspector-school-item" onclick="focarBairroNoMapaDedicado('${safeName}')">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${b.bairro}</strong>
              <span style="font-size: 11px; color: ${corVenc}; font-weight: 800;">${b.vencedor_2t} (${formatPct(b.vencedor_2t === 'Lula' ? b.pct_lula_2t : b.pct_flavio_2t)})</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-top: 3px;">
              <span>${b.total_secoes} seções</span>
              <span>Lula ${formatPct(b.pct_lula_2t)} vs Flávio ${formatPct(b.pct_flavio_2t)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function focarBairroNoMapaDedicado(nomeBairro) {
  const inst = mapInstances.full;
  if (!inst || !inst.bairrosIndex[nomeBairro]) return;
  const b = inst.bairrosIndex[nomeBairro];
  inst.map.flyTo([b.latClean, b.lngClean], 14, { duration: 0.6 });
  renderInspectorBairro(b);
}

function renderInspectorBairro(b) {
  const titleEl = document.getElementById('map-inspector-title');
  const bodyEl = document.getElementById('map-inspector-body');
  if (!titleEl || !bodyEl || !b) return;

  titleEl.innerText = `🏘️ Bairro: ${b.bairro}`;

  const locaisDoBairro = ((window.dadosMapaDedicadoAtual && window.dadosMapaDedicadoAtual.locais) || [])
    .filter(l => l.bairro === b.bairro);

  const signSwing = (b.swing_lula || 0) >= 0 ? '+' : '';
  let statusBadge = `<span class="badge-status badge-manteve">Manteve Vencedor (${b.vencedor_2t})</span>`;
  if (b.virada === 'Flávio -> Lula') {
    statusBadge = `<span class="badge-status badge-virada-lula">🔄 BAIRRO VIROU: FLÁVIO ➔ LULA</span>`;
  } else if (b.virada === 'Lula -> Flávio') {
    statusBadge = `<span class="badge-status badge-virada-flavio">🔄 BAIRRO VIROU: LULA ➔ FLÁVIO</span>`;
  }

  bodyEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      ${statusBadge}
      <button class="btn" style="padding: 4px 8px; font-size: 11px;" onclick="renderInspectorResumoCidade(window.dadosMapaDedicadoAtual)">
        ⬅ Voltar à Cidade
      </button>
    </div>

    <div class="ratio-bar-container" style="padding: 12px; margin-bottom: 12px;">
      <div class="ratio-label-row" style="font-size: 12px;">
        <span style="color: var(--lula-color); font-weight: 800;">LULA: ${formatPct(b.pct_lula_2t)}</span>
        <span style="color: var(--flavio-color); font-weight: 800;">FLÁVIO: ${formatPct(b.pct_flavio_2t)}</span>
      </div>
      <div class="ratio-bar" style="height: 12px;">
        <div class="ratio-lula" style="width: ${b.pct_lula_2t}%;"></div>
        <div class="ratio-flavio" style="width: ${b.pct_flavio_2t}%;"></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
      <div class="cand-res-box lula" style="padding: 10px;">
        <div style="font-size: 11px; color: #fca5a5; font-weight: 700;">13 - LULA</div>
        <div style="font-size: 16px; font-weight: 800;">2ºT: ${formatNumber(b.lula_2t)}</div>
        <div style="font-size: 11px; color: var(--text-dim);">1ºT: ${formatNumber(b.lula_1t)} (${formatPct(b.pct_lula_1t)})</div>
      </div>
      <div class="cand-res-box flavio" style="padding: 10px;">
        <div style="font-size: 11px; color: #93c5fd; font-weight: 700;">22 - FLÁVIO</div>
        <div style="font-size: 16px; font-weight: 800;">2ºT: ${formatNumber(b.flavio_2t)}</div>
        <div style="font-size: 11px; color: var(--text-dim);">1ºT: ${formatNumber(b.flavio_1t)} (${formatPct(b.pct_flavio_1t)})</div>
      </div>
    </div>

    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between;">
      <span>Seções no bairro: <strong>${b.total_secoes}</strong></span>
      <span>Urnas viradas: <strong style="color: #fbbf24;">${b.viradas_lula || 0}</strong></span>
      <span>Swing: <strong style="color: ${(b.swing_lula || 0) >= 0 ? '#4ade80' : '#f87171'};">${signSwing}${b.swing_lula}%</strong></span>
    </div>

    <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
      🏫 Escolas / Colégios Eleitorais neste Bairro (${locaisDoBairro.length}):
    </div>

    <div class="inspector-school-list">
      ${locaisDoBairro.length === 0 ? '<div style="font-size: 12px; color: var(--text-dim);">Nenhum local detalhado.</div>' :
        locaisDoBairro.map(loc => `
          <div class="inspector-school-item" onclick="if(mapInstances.full.map && ${loc.lat || 0}) mapInstances.full.map.flyTo([${loc.lat}, ${loc.lng}], 16)">
            <div style="font-weight: 700; color: #38bdf8;">🏫 ${loc.local}</div>
            <div style="font-size: 11px; color: var(--text-dim); margin: 2px 0;">${loc.endereco || ''} • <strong>${loc.secoes} urnas</strong></div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
              <span style="color: #fca5a5;">Lula: <strong>${formatPct(loc.pct_lula_2t)}</strong> (${formatNumber(loc.lula_2t)})</span>
              <span style="color: #93c5fd;">Flávio: <strong>${formatPct(loc.pct_flavio_2t)}</strong> (${formatNumber(loc.flavio_2t)})</span>
            </div>
          </div>
        `).join('')}
    </div>
  `;
}

function renderTabelaEscolas(locais) {
  const tbody = document.getElementById('table-escolas-body');
  if (!locais || locais.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 20px;">Nenhum colégio eleitoral registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = locais.map(l => {
    return `
      <tr>
        <td><strong>${l.local}</strong></td>
        <td><span style="color: #38bdf8;">${l.bairro}</span></td>
        <td><small style="color: var(--text-dim);">${l.endereco || '-'}</small></td>
        <td>${l.secoes} urnas</td>
        <td style="color: var(--lula-color); font-weight: 700;">${formatNumber(l.lula_2t)}</td>
        <td style="color: var(--flavio-color); font-weight: 700;">${formatNumber(l.flavio_2t)}</td>
        <td style="color: var(--lula-color); font-weight: 700;">${formatPct(l.pct_lula_2t)}</td>
        <td style="color: var(--flavio-color); font-weight: 700;">${formatPct(l.pct_flavio_2t)}</td>
        <td><strong>${l.vencedor_2t}</strong></td>
        <td style="color: #fbbf24; font-weight: 700;">${l.viradas > 0 ? l.viradas + ' viradas' : '-'}</td>
      </tr>
    `;
  }).join('');
}

function abrirBairrosDaCidade(uf, cod_mun, nome_mun) {
  switchTab('tab-bairros');
  document.getElementById('bairros-uf').value = uf;
  atualizarCidadesSelectBairros(cod_mun);
}

async function forcarAtualizacao() {
  const btn = document.querySelector('button[onclick="forcarAtualizacao()"]');
  btn.innerText = '⏳ Sincronizando...';
  try {
    await fetch('/api/forcar_atualizacao');
    await fetchStatus();
    await fetchSecoesComparadas();
    if (window.cidadesCarregadas) carregarMunicipiosEstado();
    if (window.bairrosCarregados) carregarBairrosCidade();
  } catch (err) {
    console.error(err);
  } finally {
    btn.innerText = '🔄 Atualizar Dados';
  }
}

// Inicialização automática
fetchStatus();
fetchSecoesComparadas();
preencherExemplo('SP', 82, 92);
