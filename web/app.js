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
    'tab-bairros': 'btn-tab-bairros'
  };
  const activeBtn = document.getElementById(btnMap[tabId]);
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'tab-cidades' && !window.cidadesCarregadas) {
    carregarMunicipiosEstado();
  } else if (tabId === 'tab-bairros' && !window.bairrosCarregados) {
    atualizarCidadesSelectBairros();
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
        <div style="display: flex; gap: 10px; align-items: center;">
          ${viradaTag}
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
      fetch(`/api/bairros?uf=${uf}&cod_mun=${cod_mun}&sort=${sort}&limit=150`)
    ]);

    const dataMun = await resMun.json();
    const bairros = await resBairros.json();

    renderBairrosKPICards(bairros, nome_mun);
    renderTabelaBairros(bairros);
    renderTabelaEscolas(dataMun.locais || []);
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

    return `
      <tr>
        <td><strong>${b.bairro}</strong></td>
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
