(function(){
	function toggleSenha(idCampo, elemento) {
		const campo = document.getElementById(idCampo);
		if (!campo) return;
		campo.type = campo.type === 'password' ? 'text' : 'password';
		elemento.innerText = campo.type === 'password' ? '👁️' : '🙈';
	}
	window.toggleSenha = toggleSenha;

	document.addEventListener('DOMContentLoaded', function(){
		document.body.classList.add('login-hero');
		// Restringir campos numéricos
		const cpfCad = document.getElementById('cpfCadastro');
		const whatsCad = document.getElementById('whatsappCadastro');
		[cpfCad, whatsCad].forEach(el => {
			if (!el) return;
			el.setAttribute('inputmode','numeric');
			el.setAttribute('maxlength','11');
			el.addEventListener('input', () => { el.value = el.value.replace(/\D+/g,'').slice(0,11); });
		});
	});

	function login(){
		const cpfInput = document.getElementById('cpf').value.trim();
		const senha = document.getElementById('senha').value;
		const cpfDigits = cpfInput.replace(/\D+/g,'');
		const usuarios = HBShared.getUsuarios();
		const user = usuarios[cpfInput] || usuarios[cpfDigits];
		const key = usuarios[cpfInput] ? cpfInput : (usuarios[cpfDigits] ? cpfDigits : '');
		if (user && user.senha === senha){
			HBShared.setSessionCPF(key);
			window.location.href = 'dashboard.html';
		} else {
			document.getElementById('loginMsg').innerText = 'CPF ou senha inválidos.';
		}
	}
	window.login = login;

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