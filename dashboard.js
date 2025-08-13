(function(){
	let usuarios = null;
	let contas = null;
	let ativosB3 = null;
	let usuarioAtual = null;
	let extrato = [];
	let ordens = [];
	let alertaAtivo = false;
	let precoAlvo = null;

	// Real-time chart state
	let graficoCotacaoInstance = null;
	let ativoGraficoAtual = null;
	let resolucaoMinutosAtual = 1;
	const historicoCotacoes = {};
	const MAX_HISTORY_MS = 24*60*60*1000;

	let priceChart, volumeChart, rsiChart, macdChart;

	function calcularEMA(valores, period){
		const k = 2/(period+1);
		let ema = [];
		let prev;
		for(let i=0;i<valores.length;i++){
			const v = valores[i];
			prev = i===0 ? v : v*k + prev*(1-k);
			ema.push(prev);
		}
		return ema;
	}
	function calcularSMA(valores, period){
		let out=[]; let sum=0;
		for(let i=0;i<valores.length;i++){
			sum+=valores[i];
			if(i>=period) sum-=valores[i-period];
			out.push(i>=period-1 ? sum/period : null);
		}
		return out;
	}
	function calcularBB(valores, period=20, mult=2){
		let sma = calcularSMA(valores, period);
		let upper=[], lower=[];
		for(let i=0;i<valores.length;i++){
			if(i<period-1){ upper.push(null); lower.push(null); continue; }
			let slice = valores.slice(i-period+1, i+1);
			let mean = sma[i];
			let variance = slice.reduce((acc,v)=>acc+Math.pow(v-mean,2),0)/period;
			let stdev = Math.sqrt(variance);
			upper.push(mean + mult*stdev);
			lower.push(mean - mult*stdev);
		}
		return { middle: sma, upper, lower };
	}
	function calcularRSI(valores, period=14){
		let gains=0, losses=0; let rsi=[]; let prev=valores[0];
		for(let i=1;i<valores.length;i++){
			const diff = valores[i]-prev; prev=valores[i];
			if(i<=period){ if(diff>0) gains+=diff; else losses-=diff; rsi.push(null); continue; }
			const avgGain = (gains + Math.max(0,diff))/period;
			const avgLoss = (losses + Math.max(0,-diff))/period;
			gains = avgGain * period; losses = avgLoss * period;
			const rs = avgLoss===0 ? 100 : avgGain/avgLoss;
			rsi.push(100 - 100/(1+rs));
		}
		return rsi;
	}
	function calcularMACD(valores, fast=12, slow=26, signal=9){
		const emaFast = calcularEMA(valores, fast);
		const emaSlow = calcularEMA(valores, slow);
		let macd = valores.map((_,i)=> emaFast[i]-emaSlow[i]);
		let signalArr = calcularEMA(macd, signal);
		let hist = macd.map((m,i)=> m - signalArr[i]);
		return { macd, signal: signalArr, hist };
	}

	function registrarPluginsFinanceiros(){
		try {
			if (window.ChartAnnotation) {
				Chart.register(window.ChartAnnotation);
			}
		} catch(e) { /* no-op */ }
	}

	document.addEventListener('DOMContentLoaded', function(){
		registrarPluginsFinanceiros();
		const cpf = HBShared.getSessionCPF();
		if (!cpf){ window.location.href = 'login.html'; return; }
		usuarios = HBShared.getUsuarios();
		contas = HBShared.getContas();
		ativosB3 = HBShared.getAtivos();
		Object.keys(ativosB3).forEach(a=>{ historicoCotacoes[a] = []; });

		const user = usuarios[cpf];
		if (!user){ HBShared.clearSession(); window.location.href='index.html'; return; }
		const contaRef = contas[user.conta];
		usuarioAtual = JSON.parse(JSON.stringify(contaRef));
		usuarioAtual.cpf = cpf;

		document.getElementById('username').innerText = usuarioAtual.nome;
		document.getElementById('saldo').innerText = usuarioAtual.saldo.toFixed(2);

		preencherSelectAtivos();
		preencherSelectAtivosGrafico();
		atualizarCarteira();
		atualizarBook();
		atualizarExtrato();
		atualizarOrdens();
		inicializarGraficoCotacao();

		// Layout preferido
		try {
			var preferido = localStorage.getItem('layoutPreferido') || 'dark';
			var select = document.getElementById('layout');
			if (select) { select.value = preferido; }
			aplicarLayout(preferido);
		} catch(e) {}
	});

	function logout(){ HBShared.clearSession(); window.location.href = 'index.html'; }
	window.logout = logout;

	function toggleSenha(idCampo, elemento){ const campo=document.getElementById(idCampo); if(!campo) return; campo.type = campo.type === 'password' ? 'text' : 'password'; elemento.innerText = campo.type==='password'?'👁️':'🙈'; }
	window.toggleSenha = toggleSenha;

	function alterarLayout(){ const layout=document.getElementById('layout').value; aplicarLayout(layout); try{ localStorage.setItem('layoutPreferido', layout); }catch(e){} }
	window.alterarLayout = alterarLayout;
	function aplicarLayout(layout){ if(layout==='dark'){ document.body.classList.add('dark-mode'); document.body.style.backgroundColor=''; document.body.style.color=''; } else { document.body.classList.remove('dark-mode'); if(layout==='light'){ document.body.style.backgroundColor='#fff'; document.body.style.color='#000'; } else { document.body.style.backgroundColor='#f4f6f9'; document.body.style.color='#000'; } } }

	function configurarAlertas(){ alertaAtivo = document.getElementById('alertaPreco').checked; const precoInput = parseFloat(document.getElementById('precoAlvo').value); if(alertaAtivo){ if(isNaN(precoInput)||precoInput<=0){ alert('Por favor, informe um preço alvo válido para ativar os alertas.'); document.getElementById('alertaPreco').checked=false; alertaAtivo=false; return; } precoAlvo = precoInput; alert(`Alertas de preço ativados para valores >= R$${precoAlvo.toFixed(2)}.`); } else { precoAlvo = null; alert('Alertas de preço desativados.'); } }
	window.configurarAlertas = configurarAlertas;

	function baixarRelatorio(){ if(extrato.length===0){ alert('Nenhuma operação executada registrada no extrato.'); return; } let csv = 'Data/Hora,Tipo,Ativo,Quantidade,Valor Total (R$)\n'; extrato.forEach(e=>{ csv += `"${e.dataHora}","${e.tipo}","${e.ativo}",${e.qtd},${e.total.toFixed(2)}\n`; }); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`extrato_${usuarioAtual.nome.replace(/\s+/g,'_')}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert('Relatório de operações baixado.'); }
	window.baixarRelatorio = baixarRelatorio;

	function exportarOrdensJSON(){ const ordensHoje = filtrarOrdensHoje(); if(ordensHoje.length===0){ alert('Nenhuma ordem enviada hoje.'); return;} const jsonStr = JSON.stringify(ordensHoje, null, 2); const blob = new Blob([jsonStr],{type:'application/json;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`ordens_${formatarDataArquivo(new Date())}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
	window.exportarOrdensJSON = exportarOrdensJSON;

	function exportarOrdensXLSX(){ const ordensHoje=filtrarOrdensHoje(); if(ordensHoje.length===0){ alert('Nenhuma ordem enviada hoje.'); return;} const dados = ordensHoje.map(o=>({ 'Data/Hora':o.dataHora, 'Tipo':o.tipo, 'Ativo':o.ativo, 'Quantidade':o.qtd, 'Valor (R$)':o.valor, 'Cotação (R$)':o.cotacao, 'Total (R$)':o.total, 'Status':o.status })); const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(dados); XLSX.utils.book_append_sheet(wb, ws, 'OrdensHoje'); XLSX.writeFile(wb, `ordens_${formatarDataArquivo(new Date())}.xlsx`); }
	window.exportarOrdensXLSX = exportarOrdensXLSX;

	function filtrarOrdensHoje(){ const agora=new Date(); const inicioDia=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()).getTime(); const fimDia=inicioDia+24*60*60*1000; return ordens.filter(o=>{ const ts = typeof o.timestamp==='number'?o.timestamp:Date.now(); return ts>=inicioDia && ts<fimDia; }); }
	function formatarDataArquivo(d){ const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${yyyy}${mm}${dd}_${hh}${mi}`; }

	function acessarAnalise(){ if(extrato.length===0){ alert('Nenhuma operação realizada para análise.'); return; } abrirModalAnalise(); }
	window.acessarAnalise = acessarAnalise;
	function abrirModalAnalise(){ const modal=document.getElementById('analiseModal'); modal.classList.remove('hidden'); criarGraficoAnalise(); }
	window.fecharAnalise = function(){ const modal=document.getElementById('analiseModal'); modal.classList.add('hidden'); }

	let graficoInstance=null;
	function criarGraficoAnalise(){ const ctx=document.getElementById('graficoAnalise').getContext('2d'); const dadosAtivos={}; extrato.forEach(op=>{ if(!dadosAtivos[op.ativo]) dadosAtivos[op.ativo]=0; dadosAtivos[op.ativo]+=op.qtd; }); const labels=Object.keys(dadosAtivos); const data=Object.values(dadosAtivos); if(graficoInstance) graficoInstance.destroy(); graficoInstance=new Chart(ctx,{ type:'bar', data:{ labels, datasets:[{ label:'Quantidade Operada', data, backgroundColor:'rgba(41, 128, 185, 0.7)' }] }, options:{ responsive:true, scales:{ y:{ beginAtZero:true }}} }); }

	function atualizarCarteira(){ const tbody=document.querySelector('#carteira tbody'); tbody.innerHTML=''; for(let ativo in usuarioAtual.carteira){ tbody.innerHTML += `<tr><td>${ativo}</td><td>${usuarioAtual.carteira[ativo]}</td></tr>`; } document.getElementById('saldo').innerText = usuarioAtual.saldo.toFixed(2); }
	function atualizarBook(){ const tbody=document.querySelector('#book tbody'); tbody.innerHTML=''; for(let ativo in ativosB3){ tbody.innerHTML += `<tr><td>${ativo}</td><td>${ativosB3[ativo].toFixed(2)}</td></tr>`; } }
	function preencherSelectAtivos(){ const select=document.getElementById('ativo'); select.innerHTML=''; for(let ativo in ativosB3){ select.innerHTML += `<option value="${ativo}">${ativo}</option>`; } }

	function atualizarOrdens(){ const tbody=document.querySelector('#ordens tbody'); tbody.innerHTML=''; ordens.forEach(o=>{ tbody.innerHTML += `\n      <tr>\n        <td>${o.tipo}</td>\n        <td>${o.ativo}</td>\n        <td>${o.qtd}</td>\n        <td>${o.valor.toFixed(2)}</td>\n        <td>${o.cotacao.toFixed(2)}</td>\n        <td>${o.status}</td>\n        <td>${ o.status==='Aceita' ? `<button class="btn-cancelar" onclick="cancelarOrdem(${o.id})">Cancelar</button>` : '' }</td>\n      </tr>`; }); }
	function atualizarExtrato(){ const tbody=document.querySelector('#extrato tbody'); tbody.innerHTML=''; extrato.forEach(e=>{ tbody.innerHTML += `<tr><td>${e.dataHora}</td><td>${e.tipo}</td><td>${e.ativo}</td><td>${e.qtd}</td><td>${e.total.toFixed(2)}</td></tr>`; }); }

	window.cancelarOrdem = function(id){ const ordem=ordens.find(o=>o.id===id && o.status==='Aceita'); if(ordem){ ordem.status='Cancelada'; atualizarOrdens(); document.getElementById('mensagem').innerText='Ordem cancelada.'; } }

	window.executarOperacao = function(){ const tipo=document.getElementById('tipo').value; const ativo=document.getElementById('ativo').value; const qtd=parseInt(document.getElementById('quantidade').value); const valor=parseFloat(document.getElementById('valor').value); const cotacao=ativosB3[ativo]; const total=qtd*valor; document.getElementById('mensagem').innerText=''; if(isNaN(qtd)||qtd<=0||qtd%100!==0){ document.getElementById('mensagem').innerText='Preencha uma quantidade válida (múltiplos de 100).'; return; } if(isNaN(valor)||valor<=0){ document.getElementById('mensagem').innerText='Preencha um valor válido.'; return; } if(tipo==='Compra' && total>usuarioAtual.saldo){ document.getElementById('mensagem').innerText='Saldo insuficiente para essa compra.'; return; } if(tipo==='Venda' && (!usuarioAtual.carteira[ativo] || usuarioAtual.carteira[ativo]<qtd)){ document.getElementById('mensagem').innerText='Você não possui ativos suficientes para vender.'; return; } if(Math.abs(valor-cotacao)>5){ ordens.unshift({ tipo, ativo, qtd, valor, total, cotacao, status:'Rejeitada', id:Date.now(), dataHora:new Date().toLocaleString(), timestamp:Date.now() }); atualizarOrdens(); document.getElementById('mensagem').innerText='Ordem rejeitada (diferença > R$5).'; return; } const agoraTs=Date.now(); const ordem={ tipo, ativo, qtd, valor, total, cotacao, status: valor===cotacao ? 'Executada' : 'Aceita', id:agoraTs, dataHora:new Date(agoraTs).toLocaleString(), timestamp:agoraTs }; if(ordem.status==='Executada'){ aplicarOrdem(ordem); extrato.unshift(ordem); } ordens.unshift(ordem); atualizarOrdens(); atualizarCarteira(); atualizarExtrato(); document.getElementById('mensagem').innerText='Ordem enviada.'; }

	function aplicarOrdem(o){ if(o.tipo==='Compra'){ usuarioAtual.saldo -= o.total; usuarioAtual.carteira[o.ativo] = (usuarioAtual.carteira[o.ativo]||0)+o.qtd; } else { usuarioAtual.saldo += o.total; usuarioAtual.carteira[o.ativo] -= o.qtd; if(usuarioAtual.carteira[o.ativo]<=0) delete usuarioAtual.carteira[o.ativo]; } }

	setInterval(()=>{ if(!usuarioAtual) return; for(let ativo in ativosB3){ const variacao=(Math.random()-0.5)*0.1; ativosB3[ativo] = parseFloat((ativosB3[ativo] + variacao).toFixed(2)); if(ativosB3[ativo] < 0.01) ativosB3[ativo] = 0.01; } registrarHistoricoCotacao(); ordens.forEach(o=>{ if(o.status==='Aceita'){ const precoAtual=ativosB3[o.ativo]; if((o.tipo==='Compra' && precoAtual<=o.valor) || (o.tipo==='Venda' && precoAtual>=o.valor)){ aplicarOrdem(o); o.status='Executada'; o.dataHora=new Date().toLocaleString(); o.timestamp=Date.now(); extrato.unshift(o); if(alertaAtivo && precoAlvo!==null){ if((o.tipo==='Compra' && precoAtual<=precoAlvo) || (o.tipo==='Venda' && precoAtual>=precoAlvo)){ alert(`Alerta de preço: ativo ${o.ativo} atingiu preço alvo de R$${precoAlvo.toFixed(2)}.`); } } } } }); atualizarBook(); atualizarOrdens(); atualizarCarteira(); atualizarExtrato(); atualizarGraficoCotacao(); }, 10000);

	window.alterarSenha = function(){ const novaSenha=document.getElementById('novaSenha').value.trim(); if(novaSenha.length<3){ document.getElementById('senhaMsg').innerText = 'A nova senha deve ter pelo menos 3 caracteres.'; return; } const cpf = usuarioAtual?.cpf; if(!cpf){ document.getElementById('senhaMsg').innerText='Erro: usuário não autenticado.'; return; } usuarios[cpf].senha = novaSenha; HBShared.setUsuarios(usuarios); document.getElementById('senhaMsg').innerText='Senha alterada com sucesso!'; document.getElementById('novaSenha').value=''; }

	function preencherSelectAtivosGrafico(){ const select=document.getElementById('ativoGrafico'); if(!select) return; select.innerHTML=''; for(let ativo in ativosB3){ const opt=document.createElement('option'); opt.value=ativo; opt.textContent=ativo; select.appendChild(opt); } const primeiro=Object.keys(ativosB3)[0]; select.value=primeiro; ativoGraficoAtual = primeiro; }
	// Simples gráfico de linha (modo anterior)
	function inicializarGraficoCotacao(){
		const canvas = document.getElementById('graficoCotacao');
		if (!canvas) return;
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
		if (graficoCotacaoInstance) graficoCotacaoInstance.destroy();
		graficoCotacaoInstance = new Chart(ctx, {
			type: 'line',
			data: { labels: [], datasets: [{ label: 'Cotação (R$)', data: [], borderColor: 'rgba(46, 134, 193, 1)', backgroundColor: 'rgba(46, 134, 193, 0.2)', fill: false, tension: 0.15, pointRadius: 2 }] },
			options: { responsive: true, animation: false, scales: { y: { beginAtZero: false }, x: { ticks: { maxRotation: 0 } } }, plugins: { legend: { display: true } } }
		});
		registrarHistoricoCotacao();
		// Adiciona um segundo ponto rapidamente para garantir visualização imediata
		setTimeout(()=>{ registrarHistoricoCotacao(); atualizarGraficoCotacao(); }, 100);
		atualizarGraficoCotacao();
	}
	function registrarHistoricoCotacao(){ const agora=Date.now(); for(let ativo in ativosB3){ if(!historicoCotacoes[ativo]) historicoCotacoes[ativo]=[]; historicoCotacoes[ativo].push({ ts:agora, preco:ativosB3[ativo] }); const limite=agora-MAX_HISTORY_MS; while(historicoCotacoes[ativo].length>0 && historicoCotacoes[ativo][0].ts<limite){ historicoCotacoes[ativo].shift(); } } }
	function formatarHoraMinutoSeg(d){ const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }
	function agruparHistorico(ativo, resolucaoMin){
		const pontos=historicoCotacoes[ativo]||[];
		if(pontos.length===0) return { labels:[], valores:[] };
		const bucketMs=resolucaoMin*60*1000;
		const buckets=new Map();
		for(const p of pontos){
			const chave=Math.floor(p.ts/bucketMs)*bucketMs;
			if(!buckets.has(chave)){
				buckets.set(chave, { soma:0, qtd:0, ultimo:p.preco });
			}
			const b=buckets.get(chave);
			b.soma+=p.preco; b.qtd+=1; b.ultimo=p.preco;
		}
		const chavesOrdenadas=Array.from(buckets.keys()).sort((a,b)=>a-b);
		// Fallback: se só há 1 bucket, retornar pontos brutos com HH:MM:SS
		if (chavesOrdenadas.length<=1){
			const ultimos = pontos.slice(-Math.min(30, pontos.length));
			return { labels: ultimos.map(p=>formatarHoraMinutoSeg(new Date(p.ts))), valores: ultimos.map(p=>p.preco) };
		}
		const labels=chavesOrdenadas.map(ts=>formatarHoraMinuto(new Date(ts)));
		const valores=chavesOrdenadas.map(ts=>buckets.get(ts).ultimo);
		return { labels, valores };
	}
	function formatarHoraMinuto(d){ const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${hh}:${mm}`; }

	function agruparOHLC(valores, resolucaoMin){
		let labels=[], ohlc=[], volume=[];
		const agora = Date.now();
		const step = resolucaoMin*60*1000;
		for(let i=0;i<valores.length;i++){
			const t = agora - (valores.length-i)*step;
			const open = i>0 ? valores[i-1] : valores[i];
			const close = valores[i];
			const high = Math.max(open, close) + Math.random()*0.2;
			const low = Math.min(open, close) - Math.random()*0.2;
			labels.push(t);
			ohlc.push({ t, o:open, h:high, l:low, c:close });
			volume.push( Math.round(100 + Math.random()*900) );
		}
		return { labels, ohlc, volume };
	}
})();