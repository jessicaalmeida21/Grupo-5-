// Dados de usuários e ativos
const usuarios = {
  "111.111.111-11": { senha: "123", conta: "A" },
  "222.222.222-22": { senha: "456", conta: "B" }
};

const ativosB3 = {
  PETR4: 28.50, VALE3: 72.30, ITUB4: 31.10, BBDC4: 27.80,
  ABEV3: 14.25, MGLU3: 3.45, BBAS3: 49.10, LREN3: 18.30
};

// Histórico de cotações intradiário em memória (últimas 24h)
const historicoCotacoes = {};
Object.keys(ativosB3).forEach(ativo => { historicoCotacoes[ativo] = []; });
const MAX_HISTORY_MS = 24 * 60 * 60 * 1000;

const contas = {
  A: { nome: "Conta A", saldo: 100000, carteira: { PETR4: 300, VALE3: 200, ITUB4: 100 } },
  B: { nome: "Conta B", saldo: 10, carteira: { MGLU3: 100, BBAS3: 100 } }
};

let usuarioAtual = null;
let extrato = [];
let ordens = [];
let cpfAtual = "";

// Controle de alertas
let alertaAtivo = false;
let precoAlvo = null;

// Estado do gráfico de cotação
let graficoCotacaoInstance = null;
let graficoRSIInstance = null;
let graficoVolumeInstance = null;
let graficoMACDInstance = null;
let ativoGraficoAtual = null;
let resolucaoMinutosAtual = 1;
let tipoGraficoAtual = 'candlestick'; // candlestick por padrão

function registrarPluginFinanceiro() {
  try {
    const financial = window['chartjs-chart-financial'];
    if (financial) {
      // Registra controladores/elementos se ainda não estiverem registrados
      Chart.register(
        financial.CandlestickController,
        financial.OhlcController,
        financial.CandlestickElement,
        financial.OhlcElement
      );
    }
  } catch (e) {
    // silencioso: caso o plugin já esteja registrado ou indisponível
  }
}

function semearHistoricoInicial(minutos = 60, tickIntervalSeg = 10) {
  const agora = Date.now();
  const inicio = agora - minutos * 60 * 1000;
  for (let ativo in ativosB3) {
    if (!historicoCotacoes[ativo]) historicoCotacoes[ativo] = [];
    if (historicoCotacoes[ativo].length >= 3) continue; // já possui histórico suficiente
    let preco = ativosB3[ativo];
    for (let t = inicio; t <= agora; t += tickIntervalSeg * 1000) {
      // variação pequena a cada tick
      const variacao = (Math.random() - 0.5) * 0.1;
      preco = parseFloat(Math.max(0.01, (preco + variacao)).toFixed(2));
      const vol = Math.floor(500 + Math.random() * 4500);
      historicoCotacoes[ativo].push({ ts: t, preco, vol });
    }
  }
}

// Função de login
function login() {
  const cpf = document.getElementById('cpf').value;
  const senha = document.getElementById('senha').value;
  const user = usuarios[cpf];
  if (user && user.senha === senha) {
    cpfAtual = cpf;
    const contaRef = contas[user.conta];
    usuarioAtual = JSON.parse(JSON.stringify(contaRef));
    usuarioAtual.cpf = cpf;
    extrato = [];
    ordens = [];
    document.getElementById('username').innerText = usuarioAtual.nome;
    document.getElementById('saldo').innerText = usuarioAtual.saldo.toFixed(2);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('portal').classList.remove('hidden');
    document.getElementById('configuracao').classList.remove('hidden');
    atualizarCarteira();
    atualizarBook();
    preencherSelectAtivos();
    preencherSelectAtivosGrafico();
    inicializarGraficoCotacao();
    atualizarExtrato();
    atualizarOrdens();
    document.getElementById('senhaMsg').innerText = "";
    document.getElementById('loginMsg').innerText = "";
  } else {
    document.getElementById('loginMsg').innerText = "CPF ou senha inválidos.";
  }
}

// Função de logout
function logout() {
  usuarioAtual = null;
  extrato = [];
  ordens = [];
  cpfAtual = "";
  document.getElementById('portal').classList.add('hidden');
  document.getElementById('configuracao').classList.add('hidden');
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('cpf').value = "";
  document.getElementById('senha').value = "";
  document.getElementById('mensagem').innerText = "";
  document.getElementById('senhaMsg').innerText = "";
  document.getElementById('loginMsg').innerText = "";
}

// Função de alternar visibilidade da senha
function toggleSenha(idCampo, elemento) {
  const campo = document.getElementById(idCampo);
  if (campo.type === "password") {
    campo.type = "text";
    elemento.innerText = "🙈";
  } else {
    campo.type = "password";
    elemento.innerText = "👁️";
  }
}

// Função de alterar layout (modo escuro)
function alterarLayout() {
  const layout = document.getElementById('layout').value;
  if (layout === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
    if (layout === "light") {
      document.body.style.backgroundColor = "#fff";
      document.body.style.color = "#000";
    } else {
      document.body.style.backgroundColor = "#f4f6f9";
      document.body.style.color = "#000";
    }
  }
}

// Função para configurar alertas
function configurarAlertas() {
  alertaAtivo = document.getElementById('alertaPreco').checked;
  const precoInput = parseFloat(document.getElementById('precoAlvo').value);
  if (alertaAtivo) {
    if (isNaN(precoInput) || precoInput <= 0) {
      alert("Por favor, informe um preço alvo válido para ativar os alertas.");
      document.getElementById('alertaPreco').checked = false;
      alertaAtivo = false;
      return;
    }
    precoAlvo = precoInput;
    alert(`Alertas de preço ativados para valores >= R$${precoAlvo.toFixed(2)}.`);
  } else {
    precoAlvo = null;
    alert("Alertas de preço desativados.");
  }
}

// Função para baixar relatório em CSV
function baixarRelatorio() {
  if (extrato.length === 0) {
    alert("Nenhuma operação executada registrada no extrato.");
    return;
  }
  let csv = "Data/Hora,Tipo,Ativo,Quantidade,Valor Total (R$)\n";
  extrato.forEach(e => {
    csv += `"${e.dataHora}","${e.tipo}","${e.ativo}",${e.qtd},${e.total.toFixed(2)}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `extrato_${usuarioAtual.nome.replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert("Relatório de operações baixado.");
}

// Exports de ordens do dia (JSON/XLSX)
function exportarOrdensJSON() {
  const ordensHoje = filtrarOrdensHoje();
  if (ordensHoje.length === 0) {
    alert("Nenhuma ordem enviada hoje.");
    return;
  }
  const jsonStr = JSON.stringify(ordensHoje, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordens_${formatarDataArquivo(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportarOrdensXLSX() {
  const ordensHoje = filtrarOrdensHoje();
  if (ordensHoje.length === 0) {
    alert("Nenhuma ordem enviada hoje.");
    return;
  }
  const dados = ordensHoje.map(o => ({
    "Data/Hora": o.dataHora,
    "Tipo": o.tipo,
    "Ativo": o.ativo,
    "Quantidade": o.qtd,
    "Valor (R$)": o.valor,
    "Cotação (R$)": o.cotacao,
    "Total (R$)": o.total,
    "Status": o.status
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dados);
  XLSX.utils.book_append_sheet(wb, ws, 'OrdensHoje');
  XLSX.writeFile(wb, `ordens_${formatarDataArquivo(new Date())}.xlsx`);
}

function filtrarOrdensHoje() {
  const agora = new Date();
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const fimDia = inicioDia + 24 * 60 * 60 * 1000;
  return ordens.filter(o => {
    const ts = typeof o.timestamp === 'number' ? o.timestamp : Date.now();
    return ts >= inicioDia && ts < fimDia;
  });
}

function formatarDataArquivo(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

// Função para acessar ferramentas de análise
function acessarAnalise() {
  if (extrato.length === 0) {
    alert("Nenhuma operação realizada para análise.");
    return;
  }
  abrirModalAnalise();
}

// Modal ferramentas análise
function abrirModalAnalise() {
  const modal = document.getElementById("analiseModal");
  modal.classList.remove("hidden");
  criarGraficoAnalise();
}

function fecharAnalise() {
  const modal = document.getElementById("analiseModal");
  modal.classList.add("hidden");
}

// Função para criar gráfico usando Chart.js
let graficoInstance = null;
function criarGraficoAnalise() {
  const ctx = document.getElementById("graficoAnalise").getContext("2d");
  
  // Organizar dados para gráfico: quantidade operada por ativo
  const dadosAtivos = {};
  extrato.forEach(op => {
    if (!dadosAtivos[op.ativo]) dadosAtivos[op.ativo] = 0;
    dadosAtivos[op.ativo] += op.qtd;
  });
  
  const labels = Object.keys(dadosAtivos);
  const data = Object.values(dadosAtivos);
  
  if(graficoInstance) {
    graficoInstance.destroy();
  }
  
  graficoInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Quantidade Operada',
        data,
        backgroundColor: 'rgba(102, 187, 106, 0.7)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ============================
// Gráfico de cotação em tempo real
// ============================
function preencherSelectAtivosGrafico() {
  const select = document.getElementById('ativoGrafico');
  if (!select) return;
  select.innerHTML = '';
  for (let ativo in ativosB3) {
    const opt = document.createElement('option');
    opt.value = ativo;
    opt.textContent = ativo;
    select.appendChild(opt);
  }
  // Seleciona primeiro ativo por padrão
  const primeiro = Object.keys(ativosB3)[0];
  select.value = primeiro;
  ativoGraficoAtual = primeiro;
}

function inicializarGraficoCotacao() {
  const canvas = document.getElementById('graficoCotacao');
  if (!canvas) return;

  registrarPluginFinanceiro();
  semearHistoricoInicial(60, 10);

  // Fallback de ativo selecionado
  if (!ativoGraficoAtual) {
    const keys = Object.keys(ativosB3);
    if (keys.length > 0) ativoGraficoAtual = keys[0];
  }

  // Listeners de UI
  const selectAtivo = document.getElementById('ativoGrafico');
  const selectRes = document.getElementById('resolucaoGrafico');
  if (selectAtivo) {
    selectAtivo.addEventListener('change', () => {
      ativoGraficoAtual = selectAtivo.value;
      atualizarGraficoCotacao();
    });
  }
  if (selectRes) {
    selectRes.addEventListener('change', () => {
      resolucaoMinutosAtual = parseInt(selectRes.value, 10);
      atualizarGraficoCotacao();
    });
    resolucaoMinutosAtual = parseInt(selectRes.value, 10);
  }

  const ctx = canvas.getContext('2d');
  if (graficoCotacaoInstance) {
    graficoCotacaoInstance.destroy();
  }
  const fin = window['chartjs-chart-financial'];
  const tipo = fin ? 'candlestick' : 'line';
  const baseDataset = fin ? {
    label: 'Candles',
    data: [],
    color: { up: 'rgba(76, 175, 80, 0.7)', down: 'rgba(229, 57, 53, 0.7)', unchanged: 'rgba(158, 158, 158, 0.6)' },
    borderColor: { up: 'rgba(76, 175, 80, 1)', down: 'rgba(229, 57, 53, 1)', unchanged: 'rgba(158, 158, 158, 1)' },
    wickColor: { up: 'rgba(76, 175, 80, 1)', down: 'rgba(229, 57, 53, 1)', unchanged: 'rgba(158, 158, 158, 1)' },
    borderWidth: 1
  } : {
    label: 'Preço (R$)',
    data: [],
    borderColor: 'rgba(76,175,80,1)',
    backgroundColor: 'rgba(76,175,80,0.2)',
    pointRadius: 0,
    tension: 0.15,
    parsing: false
  };
  graficoCotacaoInstance = new Chart(ctx, {
    type: tipo,
    data: {
      datasets: [
        baseDataset,
        { label: 'EMA 9', type: 'line', data: [], borderColor: 'rgba(0, 200, 83, 1)', backgroundColor: 'rgba(0, 200, 83, 0.1)', pointRadius: 0, borderWidth: 1.5, hidden: false, yAxisID: 'y' },
        { label: 'EMA 21', type: 'line', data: [], borderColor: 'rgba(56, 142, 60, 1)', backgroundColor: 'rgba(56, 142, 60, 0.1)', pointRadius: 0, borderWidth: 1.5, hidden: false, yAxisID: 'y' },
        { label: 'SMA 50', type: 'line', data: [], borderColor: 'rgba(67, 160, 71, 1)', backgroundColor: 'rgba(67, 160, 71, 0.1)', pointRadius: 0, borderWidth: 1.5, hidden: true, yAxisID: 'y' },
        { label: 'BB Upper', type: 'line', data: [], borderColor: 'rgba(76, 175, 80, 0.6)', backgroundColor: 'rgba(76, 175, 80, 0.05)', pointRadius: 0, borderWidth: 1, hidden: true, yAxisID: 'y' },
        { label: 'BB Middle', type: 'line', data: [], borderColor: 'rgba(120, 144, 156, 0.7)', backgroundColor: 'rgba(120, 144, 156, 0.05)', pointRadius: 0, borderWidth: 1, hidden: true, yAxisID: 'y' },
        { label: 'BB Lower', type: 'line', data: [], borderColor: 'rgba(76, 175, 80, 0.6)', backgroundColor: 'rgba(76, 175, 80, 0.05)', pointRadius: 0, borderWidth: 1, hidden: true, yAxisID: 'y' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      normalized: true,
      spanGaps: true,
      animation: false,
      parsing: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { adapters: { date: { zone: 'utc' } }, type: 'time', time: { unit: 'minute', parser: 'x' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.06)' } }
      }
    }
  });

  // Chart Volume
  const volCanvas = document.getElementById('graficoVolume');
  if (graficoVolumeInstance) graficoVolumeInstance.destroy();
  if (volCanvas) {
    graficoVolumeInstance = new Chart(volCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Volume', data: [], backgroundColor: [], borderWidth: 0 }] },
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: { adapters: { date: { zone: 'utc' } }, type: 'time', time: { unit: 'minute' }, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { beginAtZero: true, ticks: { maxTicksLimit: 3 }, grid: { color: 'rgba(0,0,0,0.05)' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Chart RSI secundário
  const rsiCanvas = document.getElementById('graficoRSI');
  if (graficoRSIInstance) graficoRSIInstance.destroy();
  if (rsiCanvas) {
    graficoRSIInstance = new Chart(rsiCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'RSI 14', data: [], borderColor: 'rgba(41, 182, 246, 1)', backgroundColor: 'rgba(41, 182, 246, 0.1)', pointRadius: 0, borderWidth: 1 },
          { label: 'RSI 70', data: [], borderColor: 'rgba(244, 67, 54, 0.8)', borderDash: [6, 4], pointRadius: 0, borderWidth: 1, fill: false },
          { label: 'RSI 30', data: [], borderColor: 'rgba(76, 175, 80, 0.8)', borderDash: [6, 4], pointRadius: 0, borderWidth: 1, fill: false }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: { display: true, adapters: { date: { zone: 'utc' } }, type: 'time', time: { unit: 'minute' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { min: 0, max: 100, ticks: { stepSize: 20 }, grid: { color: 'rgba(0,0,0,0.06)' } }
        },
        plugins: { legend: { display: true } }
      }
    });
  }

  // Chart MACD
  const macdCanvas = document.getElementById('graficoMACD');
  if (graficoMACDInstance) graficoMACDInstance.destroy();
  if (macdCanvas) {
    graficoMACDInstance = new Chart(macdCanvas.getContext('2d'), {
      data: {
        labels: [],
        datasets: [
          { type: 'bar', label: 'Hist', data: [], backgroundColor: 'rgba(120, 144, 156, 0.5)', borderWidth: 0 },
          { type: 'line', label: 'MACD', data: [], borderColor: 'rgba(3, 169, 244, 1)', backgroundColor: 'rgba(3, 169, 244, 0.1)', pointRadius: 0, borderWidth: 1.5 },
          { type: 'line', label: 'Signal', data: [], borderColor: 'rgba(255, 152, 0, 1)', backgroundColor: 'rgba(255, 152, 0, 0.1)', pointRadius: 0, borderWidth: 1.5 }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: { adapters: { date: { zone: 'utc' } }, type: 'time', time: { unit: 'minute' } },
          y: { ticks: { maxTicksLimit: 5 } }
        },
        plugins: { legend: { display: true } }
      }
    });
  }

  // Checkboxes dos indicadores
  const cbEma9 = document.getElementById('indEma9');
  const cbEma21 = document.getElementById('indEma21');
  const cbSma50 = document.getElementById('indSma50');
  const cbBb = document.getElementById('indBb');
  const cbRsi = document.getElementById('indRsi');
  const cbVol = document.getElementById('indVolume');
  const cbMacd = document.getElementById('indMacd');
  if (cbEma9) cbEma9.addEventListener('change', () => { graficoCotacaoInstance.getDatasetMeta(1).hidden = !cbEma9.checked; graficoCotacaoInstance.update(); });
  if (cbEma21) cbEma21.addEventListener('change', () => { graficoCotacaoInstance.getDatasetMeta(2).hidden = !cbEma21.checked; graficoCotacaoInstance.update(); });
  if (cbSma50) cbSma50.addEventListener('change', () => { graficoCotacaoInstance.getDatasetMeta(3).hidden = !cbSma50.checked; graficoCotacaoInstance.update(); });
  if (cbBb) cbBb.addEventListener('change', () => {
    graficoCotacaoInstance.getDatasetMeta(4).hidden = !cbBb.checked;
    graficoCotacaoInstance.getDatasetMeta(5).hidden = !cbBb.checked;
    graficoCotacaoInstance.getDatasetMeta(6).hidden = !cbBb.checked;
    graficoCotacaoInstance.update();
  });
  if (cbRsi) cbRsi.addEventListener('change', () => {
    const el = document.getElementById('graficoRSI');
    if (!el) return;
    if (cbRsi.checked) el.classList.remove('hidden'); else el.classList.add('hidden');
  });
  if (cbVol) cbVol.addEventListener('change', () => {
    const el = document.getElementById('graficoVolume');
    if (!el) return;
    if (cbVol.checked) el.classList.remove('hidden'); else el.classList.add('hidden');
  });
  if (cbMacd) cbMacd.addEventListener('change', () => {
    const el = document.getElementById('graficoMACD');
    if (!el) return;
    if (cbMacd.checked) el.classList.remove('hidden'); else el.classList.add('hidden');
  });

  registrarHistoricoCotacao();
  atualizarGraficoCotacao();
}

function registrarHistoricoCotacao() {
  const agora = Date.now();
  for (let ativo in ativosB3) {
    if (!historicoCotacoes[ativo]) historicoCotacoes[ativo] = [];
    // volume sintético por tick
    const vol = Math.floor(500 + Math.random() * 4500);
    historicoCotacoes[ativo].push({ ts: agora, preco: ativosB3[ativo], vol });
    // Limpeza do histórico (24h)
    const limite = agora - MAX_HISTORY_MS;
    while (historicoCotacoes[ativo].length > 0 && historicoCotacoes[ativo][0].ts < limite) {
      historicoCotacoes[ativo].shift();
    }
  }
}

function atualizarGraficoCotacao() {
  if (!graficoCotacaoInstance || !ativoGraficoAtual) return;
  const fin = window['chartjs-chart-financial'];
  const candles = calcularOHLC(ativoGraficoAtual, resolucaoMinutosAtual);
  const unit = resolucaoMinutosAtual >= 60 ? 'hour' : 'minute';
  graficoCotacaoInstance.options.scales.x.time.unit = unit;

  if (fin) {
    graficoCotacaoInstance.data.datasets[0].data = candles;
  } else {
    // fallback para linha: usar fechamento
    graficoCotacaoInstance.data.datasets[0].data = candles.map(c => ({ x: c.x, y: c.c }));
  }

  // Fechamentos e indicadores
  const closes = candles.map(c => ({ x: c.x, v: c.c }));
  const ema9 = calcularEMA(closes, 9);
  const ema21 = calcularEMA(closes, 21);
  const sma50 = calcularSMA(closes, 50);
  const bb = calcularBollinger(closes, 20, 2);
  const rsi = calcularRSI(closes, 14);

  graficoCotacaoInstance.data.datasets[1].data = ema9.map(p => ({ x: p.x, y: p.v }));
  graficoCotacaoInstance.data.datasets[2].data = ema21.map(p => ({ x: p.x, y: p.v }));
  graficoCotacaoInstance.data.datasets[3].data = sma50.map(p => ({ x: p.x, y: p.v }));
  graficoCotacaoInstance.data.datasets[4].data = bb.upper.map(p => ({ x: p.x, y: p.v }));
  graficoCotacaoInstance.data.datasets[5].data = bb.middle.map(p => ({ x: p.x, y: p.v }));
  graficoCotacaoInstance.data.datasets[6].data = bb.lower.map(p => ({ x: p.x, y: p.v }));

  graficoCotacaoInstance.update();

  // Volume
  if (graficoVolumeInstance) {
    const volData = candles.map(c => ({ x: c.x, y: c.v || 0 }));
    const colors = candles.map(c => (c.c >= c.o ? 'rgba(76, 175, 80, 0.6)' : 'rgba(229, 57, 53, 0.6)'));
    graficoVolumeInstance.data.labels = volData.map(p => p.x);
    graficoVolumeInstance.data.datasets[0].data = volData.map(p => ({ x: p.x, y: p.y }));
    graficoVolumeInstance.data.datasets[0].backgroundColor = colors;
    graficoVolumeInstance.options.scales.x.time.unit = unit;
    graficoVolumeInstance.update();
  }

  // RSI
  if (graficoRSIInstance) {
    graficoRSIInstance.data.labels = rsi.map(p => p.x);
    graficoRSIInstance.data.datasets[0].data = rsi.map(p => ({ x: p.x, y: p.v }));
    // Linhas 70/30
    const rsiLabels = rsi.map(p => p.x);
    graficoRSIInstance.data.datasets[1].data = rsiLabels.map(x => ({ x, y: 70 }));
    graficoRSIInstance.data.datasets[2].data = rsiLabels.map(x => ({ x, y: 30 }));
    graficoRSIInstance.options.scales.x.time.unit = unit;
    graficoRSIInstance.update();
  }

  // MACD
  if (graficoMACDInstance) {
    const macd = calcularMACD(closes, 12, 26, 9);
    graficoMACDInstance.data.labels = macd.map(p => p.x);
    graficoMACDInstance.data.datasets[0].data = macd.map(p => ({ x: p.x, y: p.hist }));
    graficoMACDInstance.data.datasets[1].data = macd.map(p => ({ x: p.x, y: p.macd }));
    graficoMACDInstance.data.datasets[2].data = macd.map(p => ({ x: p.x, y: p.signal }));
    graficoMACDInstance.options.scales.x.time.unit = unit;
    graficoMACDInstance.options.scales.x.grid = { color: 'rgba(0,0,0,0.06)' };
    graficoMACDInstance.options.scales.y.grid = { color: 'rgba(0,0,0,0.06)' };
    graficoMACDInstance.update();
  }
}

function calcularOHLC(ativo, resolucaoMin) {
  const pontos = historicoCotacoes[ativo] || [];
  if (pontos.length === 0) return [];
  const bucketMs = resolucaoMin * 60 * 1000;
  const buckets = new Map();
  for (const p of pontos) {
    const chave = Math.floor(p.ts / bucketMs) * bucketMs;
    if (!buckets.has(chave)) {
      buckets.set(chave, []);
    }
    buckets.get(chave).push(p);
  }
  const chaves = Array.from(buckets.keys()).sort((a, b) => a - b);
  const candles = chaves.map(ts => {
    const arr = buckets.get(ts).sort((a, b) => a.ts - b.ts);
    const open = arr[0].preco;
    const close = arr[arr.length - 1].preco;
    let high = -Infinity;
    let low = Infinity;
    let vol = 0;
    for (const it of arr) {
      if (it.preco > high) high = it.preco;
      if (it.preco < low) low = it.preco;
      vol += it.vol || 0;
    }
    return { x: new Date(ts), o: open, h: high, l: low, c: close, v: vol };
  });
  return candles;
}

function formatarHoraMinuto(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Funções de operações de compra e venda
function atualizarCarteira() {
  const tbody = document.querySelector("#carteira tbody");
  tbody.innerHTML = "";
  for (let ativo in usuarioAtual.carteira) {
    tbody.innerHTML += `<tr><td>${ativo}</td><td>${usuarioAtual.carteira[ativo]}</td></tr>`;
  }
  document.getElementById("saldo").innerText = usuarioAtual.saldo.toFixed(2);
}

function atualizarBook() {
  const tbody = document.querySelector("#book tbody");
  tbody.innerHTML = "";
  for (let ativo in ativosB3) {
    tbody.innerHTML += `<tr><td>${ativo}</td><td>${ativosB3[ativo].toFixed(2)}</td></tr>`;
  }
}

function preencherSelectAtivos() {
  const select = document.getElementById("ativo");
  select.innerHTML = "";
  for (let ativo in ativosB3) {
    select.innerHTML += `<option value="${ativo}">${ativo}</option>`;
  }
}

function atualizarOrdens() {
  const tbody = document.querySelector("#ordens tbody");
  tbody.innerHTML = "";
  ordens.forEach(o => {
    tbody.innerHTML += `
      <tr>
        <td>${o.tipo}</td>
        <td>${o.ativo}</td>
        <td>${o.qtd}</td>
        <td>${o.valor.toFixed(2)}</td>
        <td>${o.cotacao.toFixed(2)}</td>
        <td>${o.status}</td>
        <td>${
          o.status === "Aceita"
            ? `<button class="btn-cancelar" onclick="cancelarOrdem(${o.id})">Cancelar</button>`
            : ""
        }</td>
      </tr>`;
  });
}

function atualizarExtrato() {
  const tbody = document.querySelector("#extrato tbody");
  tbody.innerHTML = "";
  extrato.forEach(e => {
    tbody.innerHTML += `<tr><td>${e.dataHora}</td><td>${e.tipo}</td><td>${e.ativo}</td><td>${e.qtd}</td><td>${e.total.toFixed(2)}</td></tr>`;
  });
}

// Função de cancelamento de ordens
function cancelarOrdem(id) {
  const ordem = ordens.find(o => o.id === id && o.status === "Aceita");
  if (ordem) {
    ordem.status = "Cancelada";
    atualizarOrdens();
    document.getElementById("mensagem").innerText = "Ordem cancelada.";
  }
}

// Função de execução de operações (compra e venda)
function executarOperacao() {
  const tipo = document.getElementById('tipo').value;
  const ativo = document.getElementById('ativo').value;
  const qtd = parseInt(document.getElementById('quantidade').value);
  const valor = parseFloat(document.getElementById('valor').value);
  const cotacao = ativosB3[ativo];
  const total = qtd * valor;

  document.getElementById("mensagem").innerText = "";

  if (isNaN(qtd) || qtd <= 0 || qtd % 100 !== 0) {
    document.getElementById("mensagem").innerText = "Preencha uma quantidade válida (múltiplos de 100).";
    return;
  }
  if (isNaN(valor) || valor <= 0) {
    document.getElementById("mensagem").innerText = "Preencha um valor válido.";
    return;
  }

  if (tipo === "Compra" && total > usuarioAtual.saldo) {
    document.getElementById("mensagem").innerText = "Saldo insuficiente para essa compra.";
    return;
  }

  if (tipo === "Venda" && (!usuarioAtual.carteira[ativo] || usuarioAtual.carteira[ativo] < qtd)) {
    document.getElementById("mensagem").innerText = "Você não possui ativos suficientes para vender.";
    return;
  }

  if (Math.abs(valor - cotacao) > 5) {
    ordens.unshift({ tipo, ativo, qtd, valor, total, cotacao, status: "Rejeitada", id: Date.now(), dataHora: new Date().toLocaleString(), timestamp: Date.now() });
    atualizarOrdens();
    document.getElementById("mensagem").innerText = "Ordem rejeitada (diferença > R$5).";
    return;
  }

  const agoraTs = Date.now();
  const ordem = {
    tipo,
    ativo,
    qtd,
    valor,
    total,
    cotacao,
    status: valor === cotacao ? "Executada" : "Aceita",
    id: agoraTs,
    dataHora: new Date(agoraTs).toLocaleString(),
    timestamp: agoraTs
  };

  if (ordem.status === "Executada") {
    aplicarOrdem(ordem);
    extrato.unshift(ordem);
  }

  ordens.unshift(ordem);
  atualizarOrdens();
  atualizarCarteira();
  atualizarExtrato();
  document.getElementById("mensagem").innerText = "Ordem enviada.";
}

// Aplica ordens executadas ao saldo e carteira
function aplicarOrdem(o) {
  if (o.tipo === "Compra") {
    usuarioAtual.saldo -= o.total;
    usuarioAtual.carteira[o.ativo] = (usuarioAtual.carteira[o.ativo] || 0) + o.qtd;
  } else {
    usuarioAtual.saldo += o.total;
    usuarioAtual.carteira[o.ativo] -= o.qtd;
    if(usuarioAtual.carteira[o.ativo] <= 0) delete usuarioAtual.carteira[o.ativo];
  }
}

// Atualização automática de cotações e ordens a cada 10 segundos
setInterval(() => {
  if(!usuarioAtual) return;
  
  for (let ativo in ativosB3) {
    // Atualização aleatória do preço, +/- 0.05
    const variacao = (Math.random() - 0.5) * 0.1;
    ativosB3[ativo] = parseFloat((ativosB3[ativo] + variacao).toFixed(2));
    if(ativosB3[ativo] < 0.01) ativosB3[ativo] = 0.01;
  }

  // Registrar histórico de cotações
  registrarHistoricoCotacao();

  // Verificar ordens aceitas e executar se preço bate
  ordens.forEach(o => {
    if (o.status === "Aceita") {
      const precoAtual = ativosB3[o.ativo];
      if ((o.tipo === "Compra" && precoAtual <= o.valor) ||
          (o.tipo === "Venda" && precoAtual >= o.valor)) {
        aplicarOrdem(o);
        o.status = "Executada";
        o.dataHora = new Date().toLocaleString();
        o.timestamp = Date.now();
        extrato.unshift(o);

        // Se alerta ativo, verificar preço
        if(alertaAtivo && precoAlvo !== null) {
          if((o.tipo === "Compra" && precoAtual <= precoAlvo) ||
             (o.tipo === "Venda" && precoAtual >= precoAlvo)) {
            alert(`Alerta de preço: ativo ${o.ativo} atingiu preço alvo de R$${precoAlvo.toFixed(2)}.`);
          }
        }
      }
    }
  });

  atualizarBook();
  atualizarOrdens();
  atualizarCarteira();
  atualizarExtrato();
  atualizarGraficoCotacao();
}, 10000);

// Função para alterar senha
function alterarSenha() {
  const novaSenha = document.getElementById('novaSenha').value.trim();
  if(novaSenha.length < 3){
    document.getElementById('senhaMsg').innerText = "A nova senha deve ter pelo menos 3 caracteres.";
    return;
  }
  if(!cpfAtual || !usuarioAtual){
    document.getElementById('senhaMsg').innerText = "Erro: usuário não autenticado.";
    return;
  }
  usuarios[cpfAtual].senha = novaSenha;
  document.getElementById('senhaMsg').innerText = "Senha alterada com sucesso!";
  document.getElementById('novaSenha').value = "";
}

// Cadastro de novo usuário
function cadastrarUsuario() {
  const nome = document.getElementById('nomeCadastro').value.trim();
  const cpf = document.getElementById('cpfCadastro').value.trim();
  const whatsapp = document.getElementById('whatsappCadastro').value.trim();
  const email = document.getElementById('emailCadastro').value.trim();
  const senha = document.getElementById('senhaCadastro').value;
  const senha2 = document.getElementById('confirmarSenhaCadastro').value;
  const msg = document.getElementById('cadastroMsg');
  msg.classList.remove('error');
  msg.classList.add('success');
  msg.innerText = '';

  // Validações básicas
  if (!nome || !cpf || !whatsapp || !email || !senha || !senha2) {
    msg.classList.remove('success');
    msg.classList.add('error');
    msg.innerText = 'Preencha todos os campos.';
    return;
  }
  if (usuarios[cpf]) {
    msg.classList.remove('success');
    msg.classList.add('error');
    msg.innerText = 'CPF já cadastrado.';
    return;
  }
  if (senha !== senha2) {
    msg.classList.remove('success');
    msg.classList.add('error');
    msg.innerText = 'As senhas não conferem.';
    return;
  }
  if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    msg.classList.remove('success');
    msg.classList.add('error');
    msg.innerText = 'Email inválido.';
    return;
  }

  // Cria uma nova conta vinculada
  const contaId = `U${Date.now()}`;
  contas[contaId] = {
    nome,
    saldo: 50000,
    carteira: {}
  };

  // Salva usuário
  usuarios[cpf] = {
    senha,
    conta: contaId,
    nome,
    whatsapp,
    email
  };

  msg.innerText = 'Conta cadastrada com sucesso! Você já pode fazer login.';

  // Limpa campos
  document.getElementById('nomeCadastro').value = '';
  document.getElementById('cpfCadastro').value = '';
  document.getElementById('whatsappCadastro').value = '';
  document.getElementById('emailCadastro').value = '';
  document.getElementById('senhaCadastro').value = '';
  document.getElementById('confirmarSenhaCadastro').value = '';
}

function calcularSMA(series, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].v;
    if (i >= period) sum -= series[i - period].v;
    if (i >= period - 1) out.push({ x: series[i].x, v: sum / period });
  }
  return out;
}

function calcularEMA(series, period) {
  const out = [];
  if (series.length === 0) return out;
  const k = 2 / (period + 1);
  let emaPrev = series[0].v;
  out.push({ x: series[0].x, v: emaPrev });
  for (let i = 1; i < series.length; i++) {
    const ema = series[i].v * k + emaPrev * (1 - k);
    emaPrev = ema;
    out.push({ x: series[i].x, v: ema });
  }
  return out;
}

function calcularDesvioPadrao(janela) {
  if (janela.length === 0) return 0;
  const media = janela.reduce((a, b) => a + b, 0) / janela.length;
  const variancia = janela.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / janela.length;
  return Math.sqrt(variancia);
}

function calcularBollinger(series, period, mult) {
  const middle = calcularSMA(series, period);
  const upper = [];
  const lower = [];
  for (let i = period - 1; i < series.length; i++) {
    const janela = series.slice(i - period + 1, i + 1).map(p => p.v);
    const sd = calcularDesvioPadrao(janela);
    const m = middle[i - (period - 1)].v;
    upper.push({ x: series[i].x, v: m + mult * sd });
    lower.push({ x: series[i].x, v: m - mult * sd });
  }
  return { upper, middle, lower };
}

function calcularRSI(series, period) {
  const out = [];
  if (series.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = series[i].v - series[i - 1].v;
    if (delta >= 0) gains += delta; else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const firstRs = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  out.push({ x: series[period].x, v: firstRs });
  for (let i = period + 1; i < series.length; i++) {
    const delta = series[i].v - series[i - 1].v;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    out.push({ x: series[i].x, v: rs });
  }
  return out;
}

function calcularMACD(series, fast, slow, signalPeriod) {
  if (series.length === 0) return [];
  const emaFast = calcularEMA(series, fast);
  const emaSlow = calcularEMA(series, slow);
  // alinhar pelo menor comprimento e timestamps
  const mapSlow = new Map(emaSlow.map(p => [p.x, p.v]));
  const macdRaw = [];
  for (const p of emaFast) {
    if (mapSlow.has(p.x)) macdRaw.push({ x: p.x, v: p.v - mapSlow.get(p.x) });
  }
  // sinal sobre os valores macd
  const macdSignalArr = calcularEMA(macdRaw, signalPeriod);
  const mapSignal = new Map(macdSignalArr.map(p => [p.x, p.v]));
  const out = [];
  for (const m of macdRaw) {
    const s = mapSignal.get(m.x);
    if (typeof s === 'number') out.push({ x: m.x, macd: m.v, signal: s, hist: m.v - s });
  }
  return out;
}
