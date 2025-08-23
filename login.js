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

	// Validation helpers for cadastro
	function normalizarCPF(cpf){ return cpf.replace(/\D+/g,'').slice(0,11); }
	function validarCPF(cpf){ return normalizarCPF(cpf).length === 11; }
	function normalizarWhatsApp(valor){ return valor.replace(/\D+/g,'').slice(0,11); }
	function validarWhatsApp(valor){ return normalizarWhatsApp(valor).length === 11; }
	function validarNome(nome){
		const trimmed = nome.trim();
		if (!trimmed) return false;
		// Allow letters (including accents) and spaces only, at least 2 letters
		if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(trimmed)) return false;
		const letters = (trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[A-Za-z]/g) || []).length;
		return letters >= 2;
	}
	function validarEmail(email){
		const e = email.trim();
		// Basic email pattern
		const ok = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e);
		if (!ok) return false;
		const domain = e.split('@')[1].toLowerCase();
		// Block repeated TLD like .com.com
		if (domain.includes('.com.com')) return false;
		return true;
	}
	function setFieldError(inputEl, message){
		if (!inputEl) return;
		let span = inputEl.nextElementSibling;
		if (!span || !span.classList || !span.classList.contains('field-error')){
			span = document.createElement('div');
			span.className = 'field-error error login-meta';
			inputEl.insertAdjacentElement('afterend', span);
		}
		span.innerText = message || '';
		span.style.display = message ? 'block' : 'none';
	}
	function getBtnCadastrar(){
		return document.querySelector('button.btn-primary[onclick="cadastrarUsuario()"]');
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

		// Cadastro: refs
		const nomeCadastro = document.getElementById('nomeCadastro');
		const cpfCadastro = document.getElementById('cpfCadastro');
		const whatsappCadastro = document.getElementById('whatsappCadastro');
		const emailCadastro = document.getElementById('emailCadastro');
		const senhaCadastro = document.getElementById('senhaCadastro');
		const confirmarSenhaCadastro = document.getElementById('confirmarSenhaCadastro');

		function updateCadastroState(){
			const btnCadastrar = getBtnCadastrar();
			let allValid = true;
			// Nome
			if (!validarNome(nomeCadastro.value)) { setFieldError(nomeCadastro, 'Nome deve ter ao menos 2 letras.'); allValid = false; } else { setFieldError(nomeCadastro, ''); }
			// CPF
			const cpfOkCadastro = validarCPF(cpfCadastro.value);
			if (!cpfOkCadastro) { setFieldError(cpfCadastro, 'CPF deve conter 11 dígitos numéricos.'); allValid = false; } else { setFieldError(cpfCadastro, ''); }
			// WhatsApp
			const whatsOk = validarWhatsApp(whatsappCadastro.value);
			if (!whatsOk) { setFieldError(whatsappCadastro, 'WhatsApp deve ter 11 dígitos numéricos.'); allValid = false; } else { setFieldError(whatsappCadastro, ''); }
			// Email
			if (!validarEmail(emailCadastro.value)) { setFieldError(emailCadastro, 'Informe um e-mail válido.'); allValid = false; } else { setFieldError(emailCadastro, ''); }
			// Senhas
			if (!senhaCadastro.value || !confirmarSenhaCadastro.value || senhaCadastro.value !== confirmarSenhaCadastro.value) { setFieldError(confirmarSenhaCadastro, 'As senhas devem coincidir.'); allValid = false; } else { setFieldError(confirmarSenhaCadastro, ''); }
			if (btnCadastrar){ btnCadastrar.disabled = !allValid; btnCadastrar.classList.toggle('disabled', btnCadastrar.disabled); }
		}

		if (cpfCadastro){
			cpfCadastro.addEventListener('input', ()=>{ cpfCadastro.value = aplicarMascaraCPF(cpfCadastro.value); updateCadastroState(); });
		}
		if (whatsappCadastro){
			whatsappCadastro.addEventListener('input', ()=>{ whatsappCadastro.value = normalizarWhatsApp(whatsappCadastro.value); updateCadastroState(); });
		}
		[nomeCadastro,emailCadastro,senhaCadastro,confirmarSenhaCadastro].forEach(el=>{ if(el){ el.addEventListener('input', updateCadastroState); }});
		updateCadastroState();
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
		const nomeEl = document.getElementById('nomeCadastro');
		const cpfEl = document.getElementById('cpfCadastro');
		const whatsappEl = document.getElementById('whatsappCadastro');
		const emailEl = document.getElementById('emailCadastro');
		const senhaEl = document.getElementById('senhaCadastro');
		const confirmarSenhaEl = document.getElementById('confirmarSenhaCadastro');
		const nome = (nomeEl?.value||'').trim();
		const cpfRaw = (cpfEl?.value||'').trim();
		const cpfDigits = normalizarCPF(cpfRaw);
		const whatsappDigits = normalizarWhatsApp((whatsappEl?.value||'').trim());
		const email = (emailEl?.value||'').trim();
		const senha = senhaEl?.value||'';
		const senha2 = confirmarSenhaEl?.value||'';
		const msg = document.getElementById('cadastroMsg');
		msg.classList.remove('error'); msg.classList.add('success'); msg.innerText='';

		let valido = true;
		if (!validarNome(nome)){ setFieldError(nomeEl, 'Nome deve ter ao menos 2 letras.'); valido=false; }
		if (!validarCPF(cpfRaw)){ setFieldError(cpfEl, 'CPF deve conter 11 dígitos numéricos.'); valido=false; }
		if (!validarWhatsApp(whatsappDigits)){ setFieldError(whatsappEl, 'WhatsApp deve ter 11 dígitos numéricos.'); valido=false; }
		if (!validarEmail(email)){ setFieldError(emailEl, 'Informe um e-mail válido.'); valido=false; }
		if (!senha || senha !== senha2){ setFieldError(confirmarSenhaEl, 'As senhas devem coincidir.'); valido=false; }
		if (!valido){ msg.classList.replace('success','error'); msg.innerText='Corrija os campos destacados.'; return; }

		let usuarios = HBShared.getUsuarios();
		if (usuarios[cpfDigits] || usuarios[cpfRaw]){ msg.classList.replace('success','error'); msg.innerText='CPF já cadastrado.'; return; }

		let contas = HBShared.getContas();
		const contaId = `U${Date.now()}`;
		contas[contaId] = { nome, saldo: 50000, carteira: {} };
		usuarios[cpfDigits] = { senha, conta: contaId, nome, whatsapp: whatsappDigits, email };
		HBShared.setContas(contas);
		HBShared.setUsuarios(usuarios);
		msg.innerText = 'Conta cadastrada com sucesso! Você já pode fazer login.';
		[nomeEl, cpfEl, whatsappEl, emailEl, senhaEl, confirmarSenhaEl].forEach(el=>{ if(el) el.value=''; setFieldError(el, ''); });
		const btnCadastrar = getBtnCadastrar(); if(btnCadastrar){ btnCadastrar.disabled = true; btnCadastrar.classList.add('disabled'); }
	}
	window.cadastrarUsuario = cadastrarUsuario;
})();