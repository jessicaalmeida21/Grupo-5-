// Shared app data and session helpers
(function(global){
	const DEFAULT_USUARIOS = {
		"111.111.111-11": { senha: "123", conta: "A" },
		"222.222.222-22": { senha: "456", conta: "B" }
	};

	const DEFAULT_CONTAS = {
		A: { nome: "Conta A", saldo: 100000, carteira: { PETR4: 300, VALE3: 200, ITUB4: 100 } },
		B: { nome: "Conta B", saldo: 10, carteira: { MGLU3: 100, BBAS3: 100 } }
	};

	const DEFAULT_ATIVOS = {
		PETR4: 28.50, VALE3: 72.30, ITUB4: 31.10, BBDC4: 27.80,
		ABEV3: 14.25, MGLU3: 3.45, BBAS3: 49.10, LREN3: 18.30
	};

	const KEYS = {
		USUARIOS: 'hb_usuarios',
		CONTAS: 'hb_contas',
		SESSION: 'hb_session_cpf'
	};

	function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

	function getUsuarios(){
		try { const s = localStorage.getItem(KEYS.USUARIOS); if (s) return JSON.parse(s); } catch(e) {}
		return deepClone(DEFAULT_USUARIOS);
	}
	function setUsuarios(usuarios){ try { localStorage.setItem(KEYS.USUARIOS, JSON.stringify(usuarios)); } catch(e) {} }

	function getContas(){
		try { const s = localStorage.getItem(KEYS.CONTAS); if (s) return JSON.parse(s); } catch(e) {}
		return deepClone(DEFAULT_CONTAS);
	}
	function setContas(contas){ try { localStorage.setItem(KEYS.CONTAS, JSON.stringify(contas)); } catch(e) {} }

	function getAtivos(){ return deepClone(DEFAULT_ATIVOS); }

	function setSessionCPF(cpf){ try { localStorage.setItem(KEYS.SESSION, cpf); } catch(e) {} }
	function getSessionCPF(){ try { return localStorage.getItem(KEYS.SESSION); } catch(e) { return null; } }
	function clearSession(){ try { localStorage.removeItem(KEYS.SESSION); } catch(e) {} }

	global.HBShared = {
		getUsuarios, setUsuarios,
		getContas, setContas,
		getAtivos,
		setSessionCPF, getSessionCPF, clearSession
	};
})(window);