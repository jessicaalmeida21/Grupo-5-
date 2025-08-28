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

	function normalizeCPF(value){ return value.replace(/\D+/g,'').slice(0,11); }
	function validateNome(nome){ return /^[A-Za-zÀ-ÖØ-öø-ÿ ]{2,}$/.test(nome.trim()); }
	function validateCPF(cpf){
		const d = normalizeCPF(cpf);
		if (d.length !== 11) return false;
		if (/^(\d)\1{10}$/.test(d)) return false;
		let sum = 0;
		for (let i = 0; i < 9; i++) sum += parseInt(d[i],10) * (10 - i);
		let r = sum % 11;
		let check1 = (r < 2) ? 0 : 11 - r;
		if (check1 !== parseInt(d[9],10)) return false;
		sum = 0;
		for (let i = 0; i < 10; i++) sum += parseInt(d[i],10) * (11 - i);
		r = sum % 11;
		let check2 = (r < 2) ? 0 : 11 - r;
		if (check2 !== parseInt(d[10],10)) return false;
		return true;
	}
	function validateWhatsapp(w){ const d=w.replace(/\D+/g,''); return d.length===11; }
	function validateEmail(email){
	function validateEmail(email){
		const e = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e)) return false;
		const domain = e.split('@')[1].toLowerCase();
		const parts = domain.split('.');
		if (parts.length >= 2){
			const last = parts[parts.length-1];
			const prev = parts[parts.length-2];
			if (last === prev) return false;
		}
		return true;
	}
	function setFieldError(id, message){
		const el = document.getElementById(id);
		if(el){ el.innerText = message || ''; }
		if (id && id.indexOf('err') === 0){
			const base = id.slice(3);
			const inputId = base.charAt(0).toLowerCase() + base.slice(1);
			const input = document.getElementById(inputId);
			if (input){
				if (message){ input.classList.add('invalid'); }
				else { input.classList.remove('invalid'); }
			}
		}
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

		// Validações do cadastro em tempo real
		const nomeCad = document.getElementById('nomeCadastro');
		const cpfCad = document.getElementById('cpfCadastro');
		const whatsCad = document.getElementById('whatsappCadastro');
		const emailCad = document.getElementById('emailCadastro');
		const senhaCad = document.getElementById('senhaCadastro');
		const confirmarSenhaCad = document.getElementById('confirmarSenhaCadastro');
		if (nomeCad){
			nomeCad.addEventListener('input', ()=>{
				const sanitized = nomeCad.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ ]+/g,'');
				if (sanitized !== nomeCad.value) nomeCad.value = sanitized;
				const t = nomeCad.value.trim();
				const ok = validateNome(t);
				setFieldError('errNomeCadastro', (!ok && t.length>0) ? 'Use apenas letras e espaços (mín. 2 letras).' : '');
			});
		}
		if (cpfCad){
			cpfCad.addEventListener('input', ()=>{
				const digits = normalizeCPF(cpfCad.value);
				cpfCad.value = aplicarMascaraCPF(digits);
				let m = '';
				if (digits.length>0 && digits.length!==11) m = 'CPF deve conter 11 dígitos.';
				else if (digits.length===11 && !validateCPF(digits)) m = 'CPF inválido.';
				setFieldError('errCpfCadastro', m);
			});
		}
		if (whatsCad){
			whatsCad.addEventListener('input', ()=>{
				const digits = whatsCad.value.replace(/\D+/g,'').slice(0,11);
				whatsCad.value = digits;
				const ok = validateWhatsapp(digits);
				setFieldError('errWhatsappCadastro', (!ok && digits.length>0) ? 'WhatsApp deve conter 11 dígitos.' : '');
			});
		}
		if (emailCad){
			emailCad.addEventListener('input', ()=>{
				const ok = validateEmail(emailCad.value);
				setFieldError('errEmailCadastro', (!ok && emailCad.value.trim().length>0) ? 'Email inválido.' : '');
			});
		}
		if (senhaCad && confirmarSenhaCad){
			const checkPwd = ()=>{
				const p = senhaCad.value;
				let sMsg = '';
				if (p.length < 8) sMsg = 'Senha deve ter ao menos 8 caracteres.';
				else {
					const hasLower = /[a-z]/.test(p);
					const hasUpper = /[A-Z]/.test(p);
					const hasNumber = /\d/.test(p);
					const hasSymbol = /[^A-Za-z0-9]/.test(p);
					const lp = p.toLowerCase();
					const trivial = ['senha','123456','12345678','qwerty','password','abc123','111111','000000'];
					if (trivial.includes(lp) || /senha/.test(lp)) sMsg = 'Senha muito fraca. Evite termos comuns.';
					else if (!(hasLower && hasUpper && (hasNumber || hasSymbol))) sMsg = 'Use maiúsculas, minúsculas e número ou símbolo.';
				}
				setFieldError('errSenhaCadastro', sMsg);
				let m = '';
				if (senhaCad.value && confirmarSenhaCad.value && senhaCad.value !== confirmarSenhaCad.value) m = 'As senhas não conferem.';
				setFieldError('errConfirmarSenhaCadastro', m);
			};
			senhaCad.addEventListener('input', checkPwd);
			confirmarSenhaCad.addEventListener('input', checkPwd);
		}
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
		const cpfRaw = document.getElementById('cpfCadastro').value.trim();
		const whatsappRaw = document.getElementById('whatsappCadastro').value.trim();
		const email = document.getElementById('emailCadastro').value.trim();
		const senha = document.getElementById('senhaCadastro').value;
		const senha2 = document.getElementById('confirmarSenhaCadastro').value;
		const msg = document.getElementById('cadastroMsg');
		msg.classList.remove('error'); msg.classList.add('success'); msg.innerText='';
		['errNomeCadastro','errCpfCadastro','errWhatsappCadastro','errEmailCadastro','errSenhaCadastro','errConfirmarSenhaCadastro'].forEach(id=>setFieldError(id,''));

		let hasError = false;
		if (!validateNome(nome)){ setFieldError('errNomeCadastro','Use apenas letras e espaços (mín. 2 letras).'); hasError = true; }
		const cpfDigits = normalizeCPF(cpfRaw);
		if (!validateCPF(cpfDigits)){ setFieldError('errCpfCadastro','CPF inválido.'); hasError = true; }
		const whatsDigits = whatsappRaw.replace(/\D+/g,'');
		if (!validateWhatsapp(whatsDigits)){ setFieldError('errWhatsappCadastro','WhatsApp deve conter 11 dígitos.'); hasError = true; }
		if (!validateEmail(email)){ setFieldError('errEmailCadastro','Email inválido.'); hasError = true; }
		if (!senha || !senha2){ setFieldError('errSenhaCadastro','Informe e confirme a senha.'); setFieldError('errConfirmarSenhaCadastro','Informe e confirme a senha.'); hasError = true; }
		else {
			let sErr = '';
			if (senha.length < 8) sErr = 'Senha deve ter ao menos 8 caracteres.';
			else {
				const hasLower = /[a-z]/.test(senha);
				const hasUpper = /[A-Z]/.test(senha);
				const hasNumber = /\d/.test(senha);
				const hasSymbol = /[^A-Za-z0-9]/.test(senha);
				const ls = senha.toLowerCase();
				const trivial = ['senha','123456','12345678','qwerty','password','abc123','111111','000000'];
				if (trivial.includes(ls) || /senha/.test(ls)) sErr = 'Senha muito fraca. Evite termos comuns.';
				else if (!(hasLower && hasUpper && (hasNumber || hasSymbol))) sErr = 'Use maiúsculas, minúsculas e número ou símbolo.';
			}
			if (sErr){ setFieldError('errSenhaCadastro', sErr); hasError = true; }
			if (senha !== senha2){ setFieldError('errConfirmarSenhaCadastro','As senhas não conferem.'); hasError = true; }
		}
		if (hasError){ msg.classList.replace('success','error'); msg.innerText='Corrija os campos destacados.'; return; }

		let usuarios = HBShared.getUsuarios();
		const cpfMasked = aplicarMascaraCPF(cpfDigits);
		if (usuarios[cpfDigits] || usuarios[cpfMasked]){ setFieldError('errCpfCadastro','CPF já cadastrado.'); msg.classList.replace('success','error'); msg.innerText='CPF já cadastrado.'; return; }

		let contas = HBShared.getContas();
		const contaId = `U${Date.now()}`;
		contas[contaId] = { nome, saldo: 50000, carteira: {} };
		usuarios[cpfDigits] = { senha, conta: contaId, nome, whatsapp: whatsDigits, email };
		HBShared.setContas(contas);
		HBShared.setUsuarios(usuarios);
		msg.classList.remove('error'); msg.classList.add('success');
		msg.innerText = 'Conta cadastrada com sucesso! Você já pode fazer login.';
		['nomeCadastro','cpfCadastro','whatsappCadastro','emailCadastro','senhaCadastro','confirmarSenhaCadastro'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
		['errNomeCadastro','errCpfCadastro','errWhatsappCadastro','errEmailCadastro','errSenhaCadastro','errConfirmarSenhaCadastro'].forEach(id=>setFieldError(id,''));
	}
	window.cadastrarUsuario = cadastrarUsuario;
})();