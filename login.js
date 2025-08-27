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
	function validateCPF(cpfStr){
		const cpf = normalizeCPF(cpfStr);
		if (cpf.length !== 11) return false;
		if (/^(\d)\1{10}$/.test(cpf)) return false;
		let sum = 0; for (let i=0;i<9;i++) sum += parseInt(cpf.charAt(i),10)*(10-i);
		let d1 = (sum*10)%11; if (d1===10) d1=0; if (d1!==parseInt(cpf.charAt(9),10)) return false;
		sum = 0; for (let i=0;i<10;i++) sum += parseInt(cpf.charAt(i),10)*(11-i);
		let d2 = (sum*10)%11; if (d2===10) d2=0; if (d2!==parseInt(cpf.charAt(10),10)) return false;
		return true;
	}
	function validateWhatsapp(w){ const d=w.replace(/\D+/g,''); return d.length===11; }
	function validateSenhaComplexity(pwd){
		const s = String(pwd||'');
		if (s.length < 8) return { ok:false, msg:'Senha deve ter ao menos 8 caracteres.' };
		const lower = /[a-z]/.test(s); const upper = /[A-Z]/.test(s); const digit = /\d/.test(s); const special = /[^A-Za-z0-9]/.test(s);
		const categories = [lower, upper, digit, special].filter(Boolean).length;
		const banned = ['senha','password','123456','12345678','qwerty','admin','111111','000000'];
		if (banned.includes(s.toLowerCase())) return { ok:false, msg:'Senha muito fraca. Escolha outra.' };
		if (categories < 3) return { ok:false, msg:'Use combinação de maiúsculas, minúsculas, números e/ou símbolos.' };
		return { ok:true, msg:'' };
	}
	function validateEmail(email){
		const e = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e)) return false;
		const domain = e.split('@')[1].toLowerCase();
		const parts = domain.split('.');
		if (parts.length >= 2){
			const last = parts[parts.length-1];
			const prev = parts[parts.length-2];
			if (last === prev) return false; // evita ".com.com" e similares
		}
		return true;
	}
	function setFieldError(id, message){ const el = document.getElementById(id); if(el){ el.innerText = message || ''; } }
	function setInvalid(inputId, invalid, messageElId, message){ const input=document.getElementById(inputId); if(input){ input.classList.toggle('is-invalid', !!invalid); } if(messageElId){ setFieldError(messageElId, invalid?message:''); } }

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
				// Permite apenas letras e espaços
				const cleaned = nomeCad.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ ]+/g,'');
				if (cleaned !== nomeCad.value) nomeCad.value = cleaned;
				const ok = validateNome(nomeCad.value);
				const hasText = nomeCad.value.trim().length>0;
				const msg = hasText && !ok ? 'Use apenas letras e espaços, com pelo menos 2 letras.' : '';
				setInvalid('nomeCadastro', !ok && hasText, 'errNomeCadastro', msg);
			});
			nomeCad.addEventListener('keydown', (e)=>{
				if (e.ctrlKey || e.metaKey || e.altKey) return;
				const key = e.key;
				if (key.length === 1 && /[^A-Za-zÀ-ÖØ-öø-ÿ ]/.test(key)) e.preventDefault();
			});
			nomeCad.addEventListener('paste', (e)=>{
				const text = (e.clipboardData || window.clipboardData).getData('text');
				if (/[^A-Za-zÀ-ÖØ-öø-ÿ ]/.test(text)) e.preventDefault();
			});
		}
		if (cpfCad){
			cpfCad.addEventListener('input', ()=>{
				const digits = normalizeCPF(cpfCad.value);
				cpfCad.value = aplicarMascaraCPF(digits);
				const ok = validateCPF(digits);
				setInvalid('cpfCadastro', !ok && digits.length>0, 'errCpfCadastro', 'CPF inválido.');
			});
		}
		if (whatsCad){
			whatsCad.addEventListener('input', ()=>{
				const digits = whatsCad.value.replace(/\D+/g,'').slice(0,11);
				whatsCad.value = digits;
				const ok = validateWhatsapp(digits);
				setInvalid('whatsappCadastro', !ok && digits.length>0, 'errWhatsappCadastro', 'WhatsApp deve conter 11 dígitos.');
			});
		}
		if (emailCad){
			emailCad.addEventListener('input', ()=>{
				const ok = validateEmail(emailCad.value);
				setInvalid('emailCadastro', !ok && emailCad.value.trim().length>0, 'errEmailCadastro', 'Email inválido.');
			});
		}
		if (senhaCad && confirmarSenhaCad){
			const checkPwd = ()=>{
				const complexity = validateSenhaComplexity(senhaCad.value);
				setInvalid('senhaCadastro', !complexity.ok && senhaCad.value.length>0, 'errSenhaCadastro', complexity.msg);
				const match = senhaCad.value === confirmarSenhaCad.value;
				setInvalid('confirmarSenhaCadastro', !match && confirmarSenhaCad.value.length>0, 'errConfirmarSenhaCadastro', 'As senhas não conferem.');
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
		// Limpa erros
		['errNomeCadastro','errCpfCadastro','errWhatsappCadastro','errEmailCadastro','errSenhaCadastro','errConfirmarSenhaCadastro'].forEach(id=>setFieldError(id,''));

		let hasError = false;
		if (!validateNome(nome)){ setInvalid('nomeCadastro', true, 'errNomeCadastro','Use apenas letras e espaços, com pelo menos 2 letras.'); hasError = true; } else { setInvalid('nomeCadastro', false, 'errNomeCadastro',''); }
		const cpfDigits = normalizeCPF(cpfRaw);
		if (!validateCPF(cpfDigits)){ setInvalid('cpfCadastro', true, 'errCpfCadastro','CPF inválido.'); hasError = true; } else { setInvalid('cpfCadastro', false, 'errCpfCadastro',''); }
		const whatsDigits = whatsappRaw.replace(/\D+/g,'');
		if (!validateWhatsapp(whatsDigits)){ setInvalid('whatsappCadastro', true, 'errWhatsappCadastro','WhatsApp deve conter 11 dígitos.'); hasError = true; } else { setInvalid('whatsappCadastro', false, 'errWhatsappCadastro',''); }
		if (!validateEmail(email)){ setInvalid('emailCadastro', true, 'errEmailCadastro','Email inválido.'); hasError = true; } else { setInvalid('emailCadastro', false, 'errEmailCadastro',''); }
		const complexity = validateSenhaComplexity(senha);
		if (!senha || !senha2){ setInvalid('senhaCadastro', true, 'errSenhaCadastro','Informe e confirme a senha.'); setInvalid('confirmarSenhaCadastro', true, 'errConfirmarSenhaCadastro','Informe e confirme a senha.'); hasError = true; }
		else {
			if (!complexity.ok){ setInvalid('senhaCadastro', true, 'errSenhaCadastro', complexity.msg); hasError = true; } else { setInvalid('senhaCadastro', false, 'errSenhaCadastro',''); }
			if (senha !== senha2){ setInvalid('confirmarSenhaCadastro', true, 'errConfirmarSenhaCadastro','As senhas não conferem.'); hasError = true; } else { setInvalid('confirmarSenhaCadastro', false, 'errConfirmarSenhaCadastro',''); }
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
		['nomeCadastro','cpfCadastro','whatsappCadastro','emailCadastro','senhaCadastro','confirmarSenhaCadastro'].forEach(id=>{ const el=document.getElementById(id); if(el) { el.value=''; el.classList.remove('is-invalid'); } });
		['errNomeCadastro','errCpfCadastro','errWhatsappCadastro','errEmailCadastro','errSenhaCadastro','errConfirmarSenhaCadastro'].forEach(id=>setFieldError(id,''));
	}
	window.cadastrarUsuario = cadastrarUsuario;
})();