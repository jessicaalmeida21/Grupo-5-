// Dados de usuários e ativos
const usuarios = {
  "111.111.111-11": { senha: "123", conta: "A" },
  "222.222.222-22": { senha: "456", conta: "B" }
};

const ativosB3 = {
  PETR4: 28.50, VALE3: 72.30, ITUB4: 31.10, BBDC4: 27.80,
  ABEV3: 14.25, MGLU3: 3.45, BBAS3: 49.10, LREN3: 18.30
};

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

// Função de login
function login() {
  const cpf = document.getElementById('cpf').value;
  const senha = document.getElementById('senha').value;
  const user = usuarios[cpf];
  if (user && user.senha === senha) {
    cpfAtual = cpf;
    usuarioAtual = JSON.parse(JSON.stringify(contas[user.conta]));
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

function obterDadosGraficoAnalise() {
  const dadosAtivos = {};
  extrato.forEach(op => {
    if (!dadosAtivos[op.ativo]) dadosAtivos[op.ativo] = 0;
    dadosAtivos[op.ativo] += op.qtd;
  });
  return { labels: Object.keys(dadosAtivos), data: Object.values(dadosAtivos) };
}

function criarGraficoAnalise() {
  const ctx = document.getElementById("graficoAnalise").getContext("2d");
  const { labels, data } = obterDadosGraficoAnalise();

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

function atualizarGraficoAnalise() {
  if (!graficoInstance) return;
  const { labels, data } = obterDadosGraficoAnalise();
  graficoInstance.data.labels = labels;
  graficoInstance.data.datasets[0].data = data;
  graficoInstance.update();
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
  const index = ordens.findIndex(o => o.id === id && o.status === "Aceita");
  if (index !== -1) {
    ordens.splice(index, 1);
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
    ordens.unshift({ tipo, ativo, qtd, valor, total, cotacao, status: "Rejeitada", id: Date.now(), dataHora: new Date().toLocaleString() });
    atualizarOrdens();
    document.getElementById("mensagem").innerText = "Ordem rejeitada (diferença > R$5).";
    return;
  }

  const ordem = {
    tipo,
    ativo,
    qtd,
    valor,
    total,
    cotacao,
    status: valor === cotacao ? "Executada" : "Aceita",
    id: Date.now(),
    dataHora: new Date().toLocaleString()
  };

  if (ordem.status === "Executada") {
    aplicarOrdem(ordem);
    extrato.unshift(ordem);
  }

  ordens.unshift(ordem);
  atualizarOrdens();
  atualizarCarteira();
  atualizarExtrato();
  atualizarGraficoAnalise();
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

  // Verificar ordens aceitas e executar se preço bate
  ordens.forEach(o => {
    if (o.status === "Aceita") {
      const precoAtual = ativosB3[o.ativo];
      if ((o.tipo === "Compra" && precoAtual <= o.valor) ||
          (o.tipo === "Venda" && precoAtual >= o.valor)) {
        aplicarOrdem(o);
        o.status = "Executada";
        o.dataHora = new Date().toLocaleString();
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
  atualizarGraficoAnalise();
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
