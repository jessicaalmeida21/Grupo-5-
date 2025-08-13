(function(){
	function toggleSenha(idCampo, elemento) {
		const campo = document.getElementById(idCampo);
		if (!campo) return;
		campo.type = campo.type === 'password' ? 'text' : 'password';
		elemento.innerText = campo.type === 'password' ? '👁️' : '🙈';
	}
	window.toggleSenha = toggleSenha;

	function aplicarMascaraCPF(value){
		const digits = value.replace(/\D+/g,'').slice(0,11);
		let out = digits;
		if (digits.length > 9) out = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
		else if (digits.length > 6) out = digits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
		else if (digits.length > 3) out = digits.replace(/(\d{3})(\d{1,3})/, '$1.$2');
		return out;
	}

	document.addEventListener('DOMContentLoaded', function(){
		document.body.classList.add('login-hero');
		// Máscara e validação
		const cpfInput = document.getElementById('cpf');
		const senhaInput = document.getElementById('senha');
		const btn = document.getElementById('btnEntrar');
		const lembrar = document.getElementById('lembrar');

		try {
			const savedCpf = localStorage.getItem('hb_lembrar_cpf');
			if (savedCpf) { cpfInput.value = aplicarMascaraCPF(savedCpf); lembrar.checked = true; }
		} catch(e){}

		function updateState(){
			const cpfOk = cpfInput.value.replace(/\D+/g,'').length === 11;
			const senhaOk = senhaInput.value.trim().length >= 3;
			btn.disabled = !(cpfOk && senhaOk);
			btn.classList.toggle('disabled', btn.disabled);
		}
		cpfInput.addEventListener('input', ()=>{ cpfInput.value = aplicarMascaraCPF(cpfInput.value); updateState(); });
		senhaInput.addEventListener('input', updateState);
		cpfInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ if(!btn.disabled) login(); }});
		senhaInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ if(!btn.disabled) login(); }});
		updateState();
	});

	function login(){
		const cpfMasked = document.getElementById('cpf').value.trim();
		const senha = document.getElementById('senha').value;
		const lembrar = document.getElementById('lembrar');
		const btn = document.getElementById('btnEntrar');
		const cpfDigits = cpfMasked.replace(/\D+/g,'');
		const usuarios = HBShared.getUsuarios();
		const user = usuarios[cpfMasked] || usuarios[cpfDigits];
		const key = usuarios[cpfMasked] ? cpfMasked : (usuarios[cpfDigits] ? cpfDigits : '');
		btn.classList.add('loading'); btn.disabled = true;
		setTimeout(()=>{
			if (user && user.senha === senha){
				try { if (lembrar.checked) localStorage.setItem('hb_lembrar_cpf', cpfDigits); else localStorage.removeItem('hb_lembrar_cpf'); } catch(e){}
				HBShared.setSessionCPF(key);
				window.location.href = 'dashboard.html';
			} else {
				document.getElementById('loginMsg').innerText = 'CPF ou senha inválidos.';
				btn.classList.remove('loading'); btn.disabled = false;
			}
		}, 250);
	}
	window.login = login;

	function abrirRecuperar(e){ e && e.preventDefault(); document.getElementById('recuperarModal').classList.remove('hidden'); }
	function fecharRecuperar(){ document.getElementById('recuperarModal').classList.add('hidden'); document.getElementById('recuperarMsg').innerText=''; }
	function enviarRecuperacao(){
		const cpf = document.getElementById('cpfRecuperar').value.replace(/\D+/g,'');
		const email = document.getElementById('emailRecuperar').value.trim();
		if (cpf.length !== 11){ alert('Informe um CPF válido.'); return; }
		if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){ alert('Informe um email válido.'); return; }
		document.getElementById('recuperarMsg').innerText = 'Se o CPF/email existirem, enviaremos instruções para recuperação.';
	}
	window.abrirRecuperar = abrirRecuperar;
	window.fecharRecuperar = fecharRecuperar;
	window.enviarRecuperacao = enviarRecuperacao;

	function cadastrarUsuario(){
		const nome = document.getElementById('nomeCadastro').value.trim();
		const cpf = document.getElementById('cpfCadastro').value.trim();
		const whatsapp = document.getElementById('whatsappCadastro').value.trim();
		const email = document.getElementById('emailCadastro').value.trim();
		const senha = document.getElementById('senhaCadastro').value;
		const senha2 = document.getElementById('confirmarSenhaCadastro').value;
		const msg = document.getElementById('cadastroMsg');
		msg.classList.remove('error'); msg.classList.add('success'); msg.innerText='';
		if (!nome || !cpf || !whatsapp || !email || !senha || !senha2){ msg.classList.replace('success','error'); msg.innerText='Preencha todos os campos.'; return; }
		let usuarios = HBShared.getUsuarios();
		if (usuarios[cpf]){ msg.classList.replace('success','error'); msg.innerText='CPF já cadastrado.'; return; }
		if (senha !== senha2){ msg.classList.replace('success','error'); msg.innerText='As senhas não conferem.'; return; }
		if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){ msg.classList.replace('success','error'); msg.innerText='Email inválido.'; return; }
		let contas = HBShared.getContas();
		const contaId = `U${Date.now()}`;
		contas[contaId] = { nome, saldo: 50000, carteira: {} };
		usuarios[cpf] = { senha, conta: contaId, nome, whatsapp, email };
		HBShared.setContas(contas);
		HBShared.setUsuarios(usuarios);
		msg.innerText = 'Conta cadastrada com sucesso! Você já pode fazer login.';
		['nomeCadastro','cpfCadastro','whatsappCadastro','emailCadastro','senhaCadastro','confirmarSenhaCadastro'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
	}
	window.cadastrarUsuario = cadastrarUsuario;
})();