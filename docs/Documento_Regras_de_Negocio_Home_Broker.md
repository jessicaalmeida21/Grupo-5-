### Grupo 5 - Documento de Regras de Negócio – Home Broker

- **Versão**: 1.0
- **Data**: 2025-07-16
- **Responsável**: Analista de Negócio
- **Sistema**: Home Broker Simulado (HTML, CSS, JavaScript)

## 1. Visão Geral
- **Objetivo**: Permitir operações simuladas de compra e venda de ativos, com cotações dinâmicas e execução simplificada de ordens.
- **Persistência**: Usuários e contas são armazenados em `localStorage`. Cotações, ordens e extrato são mantidos apenas em memória durante a sessão.
- **Sessão**: Gerida por CPF (chave `hb_session_cpf`). Sem sessão válida, o acesso ao `dashboard.html` é negado e o usuário é redirecionado ao `login.html`.
- **Tecnologias**: Interface Web (`index.html`, `login.html`, `dashboard.html`), estilos em `style.css`, lógica em `home.js`, `login.js`, `dashboard.js`, utilitários e dados padrão em `shared.js`.

## 2. Identificação e Persistência de Dados
- **Usuários (`hb_usuarios`)**:
  - Estrutura: `{"<cpf>": { senha, conta, [nome], [whatsapp], [email] }}`.
  - Usuários padrão (em `shared.js`):
    - `111.111.111-11` → senha: `123`, conta: `A`.
    - `222.222.222-22` → senha: `456`, conta: `B`.
- **Contas (`hb_contas`)**:
  - Estrutura: `{"<idConta>": { nome, saldo, carteira: { <ticker>: quantidade } }}`.
  - Contas padrão:
    - `A`: nome: "Conta A", saldo: `100000`, carteira: `{ PETR4: 300, VALE3: 200, ITUB4: 100 }`.
    - `B`: nome: "Conta B", saldo: `10`, carteira: `{ MGLU3: 100, BBAS3: 100 }`.
- **Ativos disponíveis**: `PETR4, VALE3, ITUB4, BBDC4, ABEV3, MGLU3, BBAS3, LREN3` com preços iniciais em `shared.js` (retornam via `HBShared.getAtivos()` sempre em memória; não há persistência dos preços).
- **Chaves `localStorage`**: `hb_usuarios`, `hb_contas`, `hb_session_cpf`, `hb_lembrar_cpf`, `layoutPreferido`.

## 3. Login e Logout
- **Login** (`login.js`):
  - Credenciais: CPF e senha.
  - CPF aceito com máscara (`111.111.111-11`) ou apenas dígitos (`11111111111`); ambos tentados na resolução do usuário.
  - Botão "Entrar" habilita somente com CPF (11 dígitos) e senha (mín. 3 chars).
  - Sucesso: grava sessão em `hb_session_cpf` com a mesma forma da chave encontrada (mascarado ou dígitos) e redireciona para `dashboard.html`.
  - Falha: mensagem "CPF ou senha inválidos.".
  - "Lembrar-me": salva apenas os dígitos do CPF em `hb_lembrar_cpf` e pré-preenche o campo em acessos futuros.
- **Logout** (`dashboard.js`):
  - Ação "Sair": limpa `hb_session_cpf` e redireciona para `index.html`.
- **Acesso protegido**: Sem sessão válida ou usuário inexistente para a sessão, o sistema limpa sessão e redireciona para `login.html`/`index.html`.

## 4. Cadastro de Usuário
- **Campos obrigatórios**: Nome, CPF, WhatsApp, Email, Senha, Confirmar Senha.
- **Validações**:
  - Nome: apenas letras e espaços, mínimo 2 chars.
  - CPF: exatamente 11 dígitos numéricos (máscara aplicada durante a digitação).
  - WhatsApp: 10 ou 11 dígitos numéricos.
  - Email: regex padrão com salvaguarda para evitar TLD duplicado (e.g., `.com.com`).
  - Senha: informada e igual à confirmação.
- **Regra de unicidade**: CPF não pode existir (verifica tanto dígitos quanto mascarado).
- **Criação**: Gera conta `U<timestamp>` com saldo inicial `50000` e carteira vazia; salva usuário em `hb_usuarios` e conta em `hb_contas`.

## 5. Cotação de Ativos (Simulação)
- **Fonte**: Inicia com os valores de `HBShared.getAtivos()`.
- **Atualização**: A cada 10 segundos, aplica variação aleatória pequena: `preço := preço + (rand(-0,05..+0,05))`, com arredondamento para 2 casas decimais e piso `0,01`.
- **Uso**: As cotações alimentam o Book de Cotações e servem de referência para aceitação/execução de ordens.
- **Histórico**:
  - Semente inicial: ~90 minutos (180 pontos) com passo de 30s por ativo, variação pequena.
  - Armazenamento: histórico em memória por ativo; janela móvel de 24h.

## 6. Boleta de Compra e Venda
- **Campos obrigatórios**: Tipo (`Compra`/`Venda`), Ativo, Quantidade, Valor (R$).
- **Regras de validação**:
  - Quantidade: número inteiro, > 0, múltiplo de 100.
  - Valor: numérico, > 0. Interpretação: preço por unidade (apesar do placeholder indicar "por lote").
  - Compra: exige `saldo >= quantidade * valor`.
  - Venda: exige possuir `carteira[ativo] >= quantidade`.
- **Total**: `total = quantidade * valor` (sem arredondamento adicional além dos inputs).

## 7. Regra de Aceitação/Execução da Ordem (no envio)
- **Comparação com a cotação atual**: `cotacao = preçoAtual[ativo]`.
- **Lógica**:
  - Se `|valor - cotacao| > 5,00` → `Rejeitada` (motivo: diferença > R$5).
  - Se `valor == cotacao` → `Executada` imediata.
  - Caso contrário → `Aceita` (pendente de execução).

## 8. Reavaliação Automática de Ordens (a cada 10s)
- **Escopo**: Apenas ordens com status `Aceita`.
- **Condição de execução**:
  - Compra: executa quando `preçoAtual <= valor`.
  - Venda: executa quando `preçoAtual >= valor`.
- **Efeitos ao executar**:
  - Atualiza Carteira e Saldo conforme o tipo (vide seção 9).
  - Atualiza `status` para `Executada`, `dataHora` e `timestamp`.
  - Registra a operação no Extrato.
  - Atualiza Book de Cotações, Book de Ordens, Carteira, Extrato e Gráfico.

## 9. Atualização de Carteira e Saldo
- **Compra executada**:
  - `saldo := saldo - total`.
  - `carteira[ativo] := carteira[ativo] + quantidade` (cria se inexistente).
- **Venda executada**:
  - `saldo := saldo + total`.
  - `carteira[ativo] := carteira[ativo] - quantidade`; se `<= 0`, remove o ativo da carteira.
- **Observação de persistência**: Alterações na carteira e saldo durante a sessão não são gravadas de volta em `hb_contas`. Ao recarregar, os saldos/posições retornam ao estado persistido anterior (exceto para contas/usuários criados/ajustados explicitamente).

## 10. Livro de Ofertas (Book de Cotações)
- **Conteúdo**: Tabela de `Ativo` × `Preço Atual (R$)` para todos os ativos disponíveis.
- **Atualização**: A cada 10 segundos, em sincronia com as cotações.

## 11. Book de Ordens
- **Registro**: Todas as ordens enviadas com campos: `Tipo`, `Ativo`, `Quantidade`, `Valor`, `Cotação` (no envio), `Total`, `Status`, `Ação`.
- **Status possíveis**: `Aceita`, `Executada`, `Rejeitada` (diferença > R$5), `Cancelada`.
- **Cancelamento**:
  - Apenas ordens `Aceita` podem ser canceladas.
  - Efeito: muda para `Cancelada`. Não altera Carteira nem Saldo.
- **Identificador**: `id = Date.now()` no momento do envio (assumindo unicidade por milissegundo na prática).

## 12. Extrato de Operações
- **Visão**: Exibe somente ordens `Executadas`.
- **Campos**: `Data/Hora`, `Tipo`, `Ativo`, `Quantidade`, `Valor Total (R$)`.
- **Geração**: Inclusão automática quando uma ordem é executada (no envio ou na reavaliação automática).
- **Exportação**:
  - CSV do extrato de operações executadas (todas da sessão): `Baixar Relatório de Operações (CSV)`.
  - JSON e XLSX das ordens do dia (independente do status): filtradas por `timestamp` no intervalo do dia corrente.

## 13. Gráficos e Histórico de Preços
- **Componente**: Preferência por Chart.js; fallback para ApexCharts (candlestick/volume) e, na ausência, Canvas 2D customizado.
- **Resoluções**: 1, 5, 30, 60 minutos (agregação OHLC/volume a partir do histórico intradiário).
- **Modos**: `Candle` (candlestick com OHLC) e `Volume` (barras sintéticas por janela de tempo).
- **Histórico**: Janela móvel de 24h; atualização de pontos a cada 10s.

## 14. Alertas de Preço
- **Ativação**: Checkbox "Ativar Alertas de Preço" + campo "Preço Alvo" (> 0).
- **Disparo**: Exibe alerta quando, no momento da execução de uma ordem `Aceita`, o preço também atende a condição do alvo:
  - Compra: `preçoAtual <= preçoAlvo`.
  - Venda: `preçoAtual >= preçoAlvo`.
- **Observação**: O alerta é verificado durante o ciclo de reavaliação (a cada 10s) e atrelado a eventos de execução; não é uma monitoração contínua independente de ordens.

## 15. Preferências de Layout
- **Opções**: `Padrão`, `Escuro`, `Claro`.
- **Persistência**: `layoutPreferido` em `localStorage`.
- **Efeito**: Ajusta classe do `body` e cores de fundo/texto.

## 16. Validações e Máscaras (Experiência do Usuário)
- **Login**: Habilitação dinâmica do botão; Enter dispara o login nos campos de CPF/Senha.
- **Máscara de CPF**: Aplicada em tempo real tanto no login quanto no cadastro.
- **Cadastro**: Mensagens de erro por campo em tempo real; prevenção a domínios de email duplicados no TLD (e.g. `.com.com`).
- **Alteração de Senha (Dashboard)**: Nova senha com mínimo de 3 caracteres; persistida em `hb_usuarios` para o CPF da sessão.
- **Recuperação de Senha**: Modal informativo com validações básicas (CPF/Email). Não envia email real; apenas exibe mensagem de instrução condicional.

## 17. Segurança e Acesso
- **Proteção de rota**: `dashboard.html` valida a existência de sessão e usuário; em caso negativo, limpa sessão e redireciona.
- **Escopo de sessão**: Baseado em CPF armazenado como chave (pode ser mascarado ou apenas dígitos; o sistema tenta ambas formas no carregamento).

## 18. Regras de Negócio Derivadas e Limitações Conhecidas
- **Tolerância de Preço**: A regra de aceitação é absoluta (R$ 5,00), não percentual.
- **Precisão**: Cotações sempre com 2 casas decimais; valores informados na boleta aceitos como ponto flutuante.
- **Persistência parcial**:
  - Saldos, carteira, ordens e extrato são apenas em memória durante a sessão.
  - Somente cadastro de contas/usuários e alteração de senha são gravados em `localStorage`.
- **Execução temporizada**: Ordens `Aceita` são avaliadas em intervalos fixos de 10s; não há book de ofertas real (apenas uma referência de preço/ativo).
- **IDs de ordens**: `Date.now()` pode colidir em cenários extremos de múltiplos envios no mesmo milissegundo (baixa probabilidade na prática).

## 19. Interfaces e Ações do Usuário (Mapeamento de Telas)
- **`index.html`**: Página institucional (navegação, recursos, tabs, carrossel, FAQ). Sem regras de negócio de trading.
- **`login.html`**: Login, cadastro, recuperação de senha. Ligações com `login.js` e `shared.js`.
- **`dashboard.html`**: Carteira, Book de Cotações, Gráfico de preços, Boleta, Book de Ordens, Extrato, Configurações/Exportações/Análise. Ligações com `dashboard.js`, `shared.js`, `xlsx`, `Chart.js`/`ApexCharts`.

## 20. Eventos e Atualizações (Ciclo de 10s)
- A cada 10s:
  - Atualiza cotações dos ativos.
  - Registra ponto no histórico e poda janelas > 24h.
  - Reavalia ordens `Aceita` para possível execução.
  - Atualiza: Book de Cotações, Book de Ordens, Carteira, Extrato, Gráfico.

## 21. Exportações
- **Extrato (CSV)**: Todas as operações executadas na sessão.
- **Ordens do dia (JSON/XLSX)**: Filtra por `timestamp` no dia corrente (início 00:00 à 23:59:59).
- **Formato XLSX**: Usa planilha "OrdensHoje" com colunas: Data/Hora, Tipo, Ativo, Quantidade, Valor (R$), Cotação (R$), Total (R$), Status.

## 22. Regras Não Funcionais Relevantes
- **Desempenho**: Atualizações e gráficos sem animações pesadas; uso de bibliotecas de gráfico com fallback.
- **Compatibilidade**: Preferência por `Chart.js`; fallback para `ApexCharts`; fallback final para Canvas 2D próprio.
- **Acessibilidade**: Botões e controles com rótulos claros; mensagens de erro contextuais.

## 23. Glossário
- **Cotação**: Preço atual do ativo na simulação.
- **Boleta**: Formulário de envio de ordens de compra/venda.
- **Book de Cotações**: Tabela de preços simulados por ativo.
- **Book de Ordens**: Lista de ordens enviadas com status e ação de cancelamento.
- **Extrato**: Registro de operações executadas.

## 24. Itens Passíveis de Evolução
- Persistir ordens, extrato, saldo e carteira no `localStorage` após execuções.
- Implementar alerta de preço independente do ciclo de execução de ordens.
- Suporte a ordens com validade (ex.: até fim do dia) e outros tipos (Stop, Stop-Loss).
- Tolerância configurável (R$ ou %), por ativo ou global.
- Tratamento de arredondamentos monetários e precision para `total` e comparações.

---

Fonte de Verdade: Código da aplicação (`shared.js`, `login.js`, `dashboard.js`, `home.js`, `index.html`, `login.html`, `dashboard.html`, `style.css`). Este documento reflete exatamente as regras implementadas no código na data informada.