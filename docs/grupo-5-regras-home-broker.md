# Grupo 5 — Regras e Funcionalidades do Home Broker

## Visão geral
Plataforma web educacional que simula operações na B3. O app é single‑page para login/cadastro e um dashboard autenticado com carteira, book de ofertas, boleta de ordens, extrato, exportações e gráficos em tempo real.

## Acesso, sessão e segurança
- **Login**: por CPF e senha. Botão habilita apenas com CPF (11 dígitos) e senha (≥ 3 chars).
- **Lembrar CPF**: opção para persistir o CPF no `localStorage` (`hb_lembrar_cpf`).
- **Sessão**: CPF salvo em `hb_session_cpf`. Sem sessão válida, o usuário é redirecionado para `login.html`/`index.html`.
- **Logout**: limpa a sessão e redireciona para `index.html`.
- **Exibir/ocultar senha**: ícone alterna `type=password/text`.

## Cadastro e recuperação
- **Cadastro**: validações em tempo real e no submit:
  - Nome: apenas letras e espaços, mínimo 2 letras.
  - CPF: 11 dígitos numéricos, máscara aplicada.
  - WhatsApp: 10 ou 11 dígitos.
  - Email: regex padrão + checagem simples do domínio (evita `.com.com`).
  - Senhas: obrigatórias e iguais.
  - CPF único: rejeita cadastro se CPF já existir.
- **Criação de conta**: saldo inicial R$ 50.000, carteira vazia. Usuário é salvo em `hb_usuarios` e conta em `hb_contas` (ambos no `localStorage`).
- **Recuperação de acesso**: modal solicita CPF e email válidos e mostra mensagem genérica de envio (simulado).

## Dados, armazenamento e seed
- `HBShared.getUsuarios/getContas`: leem do `localStorage` com defaults se ausente.
- Defaults:
  - Usuários: `111.111.111-11` (senha `123`, conta `A`), `222.222.222-22` (senha `456`, conta `B`).
  - Contas: `A` (saldo 100.000, carteira inicial PETR4/VALE3/ITUB4), `B` (saldo 10, carteira MGLU3/BBAS3).
  - Ativos (B3 simulada): PETR4, VALE3, ITUB4, BBDC4, ABEV3, MGLU3, BBAS3, LREN3 com preços de seed.

## Dashboard (após login)
- **Carteira**: tabela dinâmica com ativos e quantidades; saldo exibido no header.
- **Book de ofertas (B3)**: tabela de preços atuais simulados; atualização periódica.
- **Gráfico em tempo real**:
  - Dados: histórico sintético por ativo; atualização contínua (candles/volumes agregados por 1, 5, 30, 60 min).
  - Renderização: prefere Chart.js (linha de fechamento); fallback para ApexCharts (candlestick) se disponível; fallback Canvas2D customizado.
  - Controles: seleção de ativo, resolução temporal e modo de exibição (Candlestick/Volume).
- **Boleta de Compra e Venda**:
  - Campos: Tipo (Compra/Venda), Ativo, Quantidade, Valor por lote.
  - Validações:
    - Quantidade: número inteiro, > 0, em múltiplos de 100.
    - Valor: número > 0.
    - Compra: saldo suficiente para `qtd * valor`.
    - Venda: possuir quantidade suficiente do ativo.
    - Preço limite: se `|valor - cotação| > 5`, ordem é rejeitada imediatamente.
  - Envio: cria ordem com status:
    - `Executada` se `valor === cotação` (aplica efeitos na carteira/saldo e adiciona ao extrato).
    - `Aceita` caso contrário (fica pendente até condição de execução).
- **Execução automática e cotações**:
  - A cada 10s: preços variam levemente; histórico é registrado (janela de 24h fixa em memória).
  - Para ordens `Aceita`, executa quando:
    - Compra: cotação atual <= valor da ordem.
    - Venda: cotação atual >= valor da ordem.
  - Ao executar: aplica efeitos em saldo/carteira, move para extrato e atualiza tabelas.
- **Cancelamento de ordens**: ordens `Aceita` podem ser canceladas (botão por linha).
- **Extrato de operações**: lista operações executadas (data/hora, tipo, ativo, qtd, total).
- **Exportações**:
  - Extrato (todas as execuções) em CSV.
  - Ordens do dia em XLSX (via `xlsx`) e JSON.
- **Ferramentas de Análise**:
  - Modal com gráfico de barras (Chart.js) somando quantidade operada por ativo no extrato.
- **Configurações**:
  - Layout: `Padrão`, `Escuro`, `Claro` com persistência em `localStorage`.
  - Alertas de preço: checkbox + preço alvo; ao executar ordem em preço além/abaixo do alvo, alerta de browser é exibido.

## Regras de negócio detalhadas
- Quantidade mínima/step: 100 em 100 (lote padrão).
- Diferença máxima entre preço limite e cotação: R$ 5,00 (senão `Rejeitada`).
- Status de ordem:
  - `Rejeitada`: falha de validação ou diferença > R$ 5,00.
  - `Aceita`: pendente de execução automática futura.
  - `Executada`: executada imediatamente (valor === cotação) ou no ciclo de atualização.
  - `Cancelada`: cancelada manualmente enquanto `Aceita`.
- Atualização periódica: 10s ajusta cotações, verifica execuções e redesenha gráficos/tabelas.
- Carteira e saldo:
  - Compra: saldo -= total; carteira[ativo] += qtd.
  - Venda: saldo += total; carteira[ativo] -= qtd (remove ativo se zera).

## Limitações e escopo (simulação)
- Cotações, volumes e execuções são simulados em cliente, sem integração com corretora/market data real.
- Sem ordens parciais, taxas, slippage, horários de pregão ou livro de ofertas real.
- Persistência apenas em `localStorage` (dados locais por navegador).
- Segurança limitada ao ambiente educacional (sem criptografia de dados sensíveis).

## Páginas e navegação
- `index.html`: landing com navegação, seções (recursos, plataformas, FAQ), CTA para login/cadastro.
- `login.html`: login, cadastro com validação, modal de recuperação.
- `dashboard.html`: interface autenticada (carteira, book, boleta, extrato, ordens, gráfico, análise, configurações).

## Versão e autoria
- Versão do documento: 1.0
- Atualizado em: 23/08/2025
- Fonte: inspeção do código `login.js`, `dashboard.js`, `shared.js`, `dashboard.html`, `style.css`.