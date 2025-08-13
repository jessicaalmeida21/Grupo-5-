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
let ativoGraficoAtual = null;
let resolucaoMinutosAtual = 1;

// Função de login
function login() {
  const cpfInput = document.getElementById('cpf').value;
  const senha = document.getElementById('senha').value;
  const cpfDigits = cpfInput.replace(/\D+/g, '');
  const user = usuarios[cpfInput] || usuarios[cpfDigits];
  const cpfKey = usuarios[cpfInput] ? cpfInput : (usuarios[cpfDigits] ? cpfDigits : '');
  if (user && user.senha === senha) {
    cpfAtual = cpfKey;
    const contaRef = contas[user.conta];
    usuarioAtual = JSON.parse(JSON.stringify(contaRef));
    usuarioAtual.cpf = cpfKey;
    extrato = [];
    ordens = [];
    document.getElementById('username').innerText = usuarioAtual.nome;
    document.getElementById('saldo').innerText = usuarioAtual.saldo.toFixed(2);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('portal').classList.remove('hidden');
    document.getElementById('configuracao').classList.remove('hidden');
    document.body.classList.remove('login-hero');
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
  document.body.classList.add('login-hero');
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
  aplicarLayout(layout);
  try { localStorage.setItem('layoutPreferido', layout); } catch (e) {}
}

function aplicarLayout(layout) {
  if (layout === "dark") {
    document.body.classList.add("dark-mode");
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
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

// Aplica o layout salvo (ou dark por padrão) ao carregar a página
try {
  document.addEventListener('DOMContentLoaded', function() {
    var preferido = localStorage.getItem('layoutPreferido') || 'dark';
    var select = document.getElementById('layout');
    if (select) { select.value = preferido; }
    aplicarLayout(preferido);
    document.body.classList.add('login-hero');
    // Restringe somente números nos campos de CPF e WhatsApp do cadastro
    const cpfCad = document.getElementById('cpfCadastro');
    const whatsCad = document.getElementById('whatsappCadastro');
    if (cpfCad) {
      cpfCad.setAttribute('inputmode', 'numeric');
      cpfCad.setAttribute('maxlength', '11');
      cpfCad.addEventListener('input', () => {
        cpfCad.value = cpfCad.value.replace(/\D+/g, '').slice(0, 11);
      });
    }
    if (whatsCad) {
      whatsCad.setAttribute('inputmode', 'numeric');
      whatsCad.setAttribute('maxlength', '11');
      whatsCad.addEventListener('input', () => {
        whatsCad.value = whatsCad.value.replace(/\D+/g, '').slice(0, 11);
      });
    }
  });
} catch (e) {}

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
        backgroundColor: 'rgba(41, 128, 185, 0.7)'
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

  // Cria instância
  const ctx = canvas.getContext('2d');
  if (graficoCotacaoInstance) {
    graficoCotacaoInstance.destroy();
  }
  graficoCotacaoInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Cotação (R$)',
        data: [],
        borderColor: 'rgba(46, 134, 193, 1)',
        backgroundColor: 'rgba(46, 134, 193, 0.2)',
        fill: false,
        tension: 0.15,
        pointRadius: 1
      }]
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { beginAtZero: false },
        x: { ticks: { maxRotation: 0 } }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });

  // Registra um snapshot inicial
  registrarHistoricoCotacao();
  atualizarGraficoCotacao();
}

function registrarHistoricoCotacao() {
  const agora = Date.now();
  for (let ativo in ativosB3) {
    if (!historicoCotacoes[ativo]) historicoCotacoes[ativo] = [];
    historicoCotacoes[ativo].push({ ts: agora, preco: ativosB3[ativo] });
    // Limpeza do histórico (24h)
    const limite = agora - MAX_HISTORY_MS;
    while (historicoCotacoes[ativo].length > 0 && historicoCotacoes[ativo][0].ts < limite) {
      historicoCotacoes[ativo].shift();
    }
  }
}

function atualizarGraficoCotacao() {
  if (!graficoCotacaoInstance || !ativoGraficoAtual) return;
  const { labels, valores } = agruparHistorico(ativoGraficoAtual, resolucaoMinutosAtual);
  graficoCotacaoInstance.data.labels = labels;
  graficoCotacaoInstance.data.datasets[0].data = valores;
  graficoCotacaoInstance.update();
}

function agruparHistorico(ativo, resolucaoMin) {
  const pontos = historicoCotacoes[ativo] || [];
  if (pontos.length === 0) return { labels: [], valores: [] };

  const bucketMs = resolucaoMin * 60 * 1000;
  const buckets = new Map();

  for (const p of pontos) {
    const chave = Math.floor(p.ts / bucketMs) * bucketMs;
    if (!buckets.has(chave)) {
      buckets.set(chave, { soma: 0, qtd: 0, ultimo: p.preco });
    }
    const b = buckets.get(chave);
    b.soma += p.preco;
    b.qtd += 1;
    b.ultimo = p.preco; // valor de fechamento do bucket
  }

  const chavesOrdenadas = Array.from(buckets.keys()).sort((a, b) => a - b);
  const labels = chavesOrdenadas.map(ts => formatarHoraMinuto(new Date(ts)));
  const valores = chavesOrdenadas.map(ts => buckets.get(ts).ultimo);
  return { labels, valores };
}

function formatarHoraMinuto(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`