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
	function inicializarGraficoCotacao(){
		const priceCanvas = document.getElementById('graficoPreco');
		const volCanvas = document.getElementById('graficoVolume');
		const rsiCanvas = document.getElementById('graficoRSI');
		const macdCanvas = document.getElementById('graficoMACD');
		if(!priceCanvas) return;

		// listeners
		const selectAtivo=document.getElementById('ativoGrafico');
		const selectRes=document.getElementById('resolucaoGrafico');
		if(selectAtivo){ selectAtivo.addEventListener('change', ()=>{ ativoGraficoAtual=selectAtivo.value; atualizarGraficoCotacao(); }); }
		if(selectRes){ selectRes.addEventListener('change', ()=>{ resolucaoMinutosAtual=parseInt(selectRes.value,10); atualizarGraficoCotacao(); }); resolucaoMinutosAtual=parseInt(selectRes.value,10); }
		['toggleEMA9','toggleEMA21','toggleSMA50','toggleBB','toggleVolume','toggleMACD'].forEach(id=>{
			const el=document.getElementById(id); if(el){ el.addEventListener('change', atualizarGraficoCotacao); }
		});

		const grid = { color: 'rgba(0,0,0,0.06)' };
		const commonOpts = { animation:false, responsive:true, parsing:false, scales:{ x:{ type:'time', grid }, y:{ grid } }, plugins:{ legend:{ display:false } } };

		if(priceChart) priceChart.destroy();
		try {
			priceChart = new Chart(priceCanvas.getContext('2d'), {
				type: 'candlestick',
				data: { datasets: [] },
				options: {
					...commonOpts,
					plugins:{ ...commonOpts.plugins, annotation:{ annotations: {} } }
				}
			});
		} catch(err) {
			priceChart = new Chart(priceCanvas.getContext('2d'), {
				type: 'ohlc',
				data: { datasets: [] },
				options: { ...commonOpts }
			});
		}
		if(volumeChart) volumeChart.destroy();
		volumeChart = new Chart(volCanvas.getContext('2d'), { type:'bar', data:{ labels:[], datasets:[{ label:'Volume', data:[], backgroundColor:'rgba(22,163,74,0.35)' }]}, options:{ ...commonOpts, scales:{ x:{ grid }, y:{ grid, beginAtZero:true } } }});
		if(rsiChart) rsiChart.destroy();
		rsiChart = new Chart(rsiCanvas.getContext('2d'), { type:'line', data:{ labels:[], datasets:[{ label:'RSI', data:[], borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.15)', fill:true, tension:0.2 }]}, options:{ ...commonOpts, plugins:{ ...commonOpts.plugins, annotation:{ annotations:{ rsi70:{ type:'line', yMin:70, yMax:70, borderColor:'#ef4444', borderWidth:1, borderDash:[6,4] }, rsi30:{ type:'line', yMin:30, yMax:30, borderColor:'#10b981', borderWidth:1, borderDash:[6,4] } } } }, scales:{ y:{ min:0, max:100, grid } } }});
		if(macdChart) macdChart.destroy();
		macdChart = new Chart(macdCanvas.getContext('2d'), { type:'bar', data:{ labels:[], datasets:[{ label:'Hist', data:[], backgroundColor:(ctx)=> (ctx.raw>=0?'rgba(22,163,74,0.5)':'rgba(239,68,68,0.5)') },{ label:'MACD', type:'line', data:[], borderColor:'#16a34a' },{ label:'Signal', type:'line', data:[], borderColor:'#ef4444' }]}, options:{ ...commonOpts } });

		registrarHistoricoCotacao();
		atualizarGraficoCotacao();
	}
	function registrarHistoricoCotacao(){ const agora=Date.now(); for(let ativo in ativosB3){ if(!historicoCotacoes[ativo]) historicoCotacoes[ativo]=[]; historicoCotacoes[ativo].push({ ts:agora, preco:ativosB3[ativo] }); const limite=agora-MAX_HISTORY_MS; while(historicoCotacoes[ativo].length>0 && historicoCotacoes[ativo][0].ts<limite){ historicoCotacoes[ativo].shift(); } } }
	function agruparOHLCFromHistorico(ativo, resolucaoMin){
		const pontos = historicoCotacoes[ativo] || [];
		if (!pontos.length) return { labels: [], ohlc: [], volume: [] };
		const bucketMs = resolucaoMin * 60 * 1000;
		const buckets = new Map();
		for (const p of pontos) {
			const key = Math.floor(p.ts / bucketMs) * bucketMs;
			let b = buckets.get(key);
			if (!b) { b = { t: key, o: p.preco, h: p.preco, l: p.preco, c: p.preco, count: 1 }; buckets.set(key, b); continue; }
			// atualiza OHLC
			if (b.count === 1) { b.c = p.preco; } else { b.c = p.preco; }
			if (p.preco > b.h) b.h = p.preco;
			if (p.preco < b.l) b.l = p.preco;
			b.count += 1;
		}
		const keys = Array.from(buckets.keys()).sort((a,b)=>a-b);
		const labels = keys;
		const ohlc = keys.map(k => { const b = buckets.get(k); return { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }; });
		const volume = keys.map(k => buckets.get(k).count);
		return { labels, ohlc, volume };
	}
	function atualizarGraficoCotacao(){
		if(!priceChart || !ativoGraficoAtual) return;
		const { labels: l2, ohlc, volume } = agruparOHLCFromHistorico(ativoGraficoAtual, resolucaoMinutosAtual);
		if(!ohlc.length){
			priceChart.data.labels = [];
			priceChart.data.datasets = [];
			priceChart.update();
			volumeChart.data.labels = [];
			volumeChart.data.datasets[0].data = [];
			volumeChart.update();
			rsiChart.data.labels = [];
			rsiChart.data.datasets[0].data = [];
			rsiChart.update();
			macdChart.data.labels = [];
			macdChart.data.datasets.forEach(d=>d.data = []);
			macdChart.update();
			return;
		}
		const closes = ohlc.map(c=>c.c);
		const ema9 = calcularEMA(closes, 9);
		const ema21 = calcularEMA(closes, 21);
		const sma50 = calcularSMA(closes, 50);
		const bb = calcularBB(closes, 20, 2);

		priceChart.data.labels = l2;
		const candleDataset = { label:'Preço', data: ohlc, type: priceChart.config.type, borderColor:'#111827', color:{ up:'#16a34a', down:'#ef4444', unchanged:'#9ca3af' }, barThickness: 6 };
		priceChart.data.datasets = [ candleDataset ];
		if(document.getElementById('toggleEMA9')?.checked){ priceChart.data.datasets.push({ label:'EMA 9', type:'line', data: ema9, borderColor:'#22c55e', borderWidth:1.2, pointRadius:0 }); }
		if(document.getElementById('toggleEMA21')?.checked){ priceChart.data.datasets.push({ label:'EMA 21', type:'line', data: ema21, borderColor:'#10b981', borderWidth:1.2, pointRadius:0 }); }
		if(document.getElementById('toggleSMA50')?.checked){ priceChart.data.datasets.push({ label:'SMA 50', type:'line', data: sma50, borderColor:'#6b7280', borderWidth:1.2, pointRadius:0 }); }
		if(document.getElementById('toggleBB')?.checked){ priceChart.data.datasets.push({ label:'BB Upper', type:'line', data: bb.upper, borderColor:'rgba(107,114,128,0.8)', borderDash:[4,3], pointRadius:0 }); priceChart.data.datasets.push({ label:'BB Middle', type:'line', data: bb.middle, borderColor:'rgba(156,163,175,0.8)', pointRadius:0 }); priceChart.data.datasets.push({ label:'BB Lower', type:'line', data: bb.lower, borderColor:'rgba(107,114,128,0.8)', borderDash:[4,3], pointRadius:0 }); }
		priceChart.update();

		if(document.getElementById('toggleVolume')?.checked){
			volumeChart.data.labels = l2;
			volumeChart.data.datasets[0].data = volume;
			volumeChart.update();
		} else { volumeChart.data.labels=[]; volumeChart.data.datasets[0].data=[]; volumeChart.update(); }

		const rsi = calcularRSI(closes, 14);
		rsiChart.data.labels=l2; rsiChart.data.datasets[0].data=rsi; rsiChart.update();

		const macd = calcularMACD(closes);
		if(document.getElementById('toggleMACD')?.checked){
			macdChart.data.labels=l2;
			macdChart.data.datasets[0].data=macd.hist;
			macdChart.data.datasets[1].data=macd.macd;
			macdChart.data.datasets[2].data=macd.signal;
			macdChart.update();
		} else { macdChart.data.labels=[]; macdChart.data.datasets.forEach(d=>d.data=[]); macdChart.update(); }
	}
	function agruparHistorico(ativo, resolucaoMin){ const pontos=historicoCotacoes[ativo]||[]; if(pontos.length===0) return { labels:[], valores:[] }; const bucketMs=resolucaoMin*60*1000; const buckets=new Map(); for(const p of pontos){ const chave=Math.floor(p.ts/bucketMs)*bucketMs; if(!buckets.has(chave)){ buckets.set(chave, { soma:0, qtd:0, ultimo:p.preco }); } const b=buckets.get(chave); b.soma+=p.preco; b.qtd+=1; b.ultimo=p.preco; } const chavesOrdenadas=Array.from(buckets.keys()).sort((a,b)=>a-b); const labels=chavesOrdenadas.map(ts=>formatarHoraMinuto(new Date(ts))); const valores=chavesOrdenadas.map(ts=>buckets.get(ts).ultimo); return { labels, valores }; }
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