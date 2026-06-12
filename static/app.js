const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const typeLabels = {
  income: "Rendimento",
  fixed_expense: "Gasto mensal",
  variable_expense: "Gasto variavel",
  unexpected_expense: "Imprevisto",
  other_expense: "Outra despesa",
};

const state = {
  me: null,
  summary: null,
  transactions: [],
  token: localStorage.getItem("finance_token"),
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Erro na requisicao");
  }
  if (response.status === 204) return null;
  return response.json();
}

function setAuthMessage(message) {
  document.querySelector("[data-auth-message]").textContent = message;
}

function showApp(isAuthenticated) {
  document.querySelector("[data-auth-view]").hidden = isAuthenticated;
  document.querySelector("[data-app-view]").hidden = !isAuthenticated;
}

async function register(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  payload.consent_lgpd = payload.consent_lgpd === "on";
  try {
    const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
    document.querySelector("[data-confirm-form]").hidden = false;
    document.querySelector("[data-confirm-form] [name=token]").value = data.confirmation_token || "";
    setAuthMessage(data.confirmation_token
      ? "Conta criada. Em producao esse token sera enviado por email; no dev ele foi preenchido abaixo."
      : data.message);
  } catch (error) {
    setAuthMessage("Nao foi possivel criar a conta. Verifique se o email ja existe.");
  }
}

async function login(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    state.token = data.token;
    localStorage.setItem("finance_token", data.token);
    showApp(true);
    await refresh();
  } catch (error) {
    setAuthMessage("Login invalido ou email ainda nao confirmado.");
  }
}

async function confirmEmail(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await api("/api/auth/confirm-email", { method: "POST", body: JSON.stringify(payload) });
    state.token = data.token;
    localStorage.setItem("finance_token", data.token);
    showApp(true);
    await refresh();
  } catch (error) {
    setAuthMessage("Token invalido ou expirado.");
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function renderSummary() {
  const s = state.summary || { income: 0, expenses: 0, balance: 0, unexpected: 0, savings_rate: 0 };
  document.querySelector("[data-income]").textContent = money.format(Number(s.income));
  document.querySelector("[data-expenses]").textContent = money.format(Number(s.expenses));
  document.querySelector("[data-balance]").textContent = money.format(Number(s.balance));
  document.querySelector("[data-unexpected]").textContent = money.format(Number(s.unexpected));
  document.querySelector("[data-savings]").textContent = `${Number(s.savings_rate).toFixed(1)}%`;

  const usage = state.me?.is_subscribed
    ? "Plano ativo"
    : `${state.me?.used_this_month ?? 0}/${state.me?.free_limit ?? 0} perguntas gratis`;
  document.querySelector("[data-usage]").textContent = usage;
  document.querySelector("[data-subscription]").checked = Boolean(state.me?.is_subscribed);
}

function renderTransactions() {
  const list = document.querySelector("[data-transactions]");
  if (!state.transactions.length) {
    list.innerHTML = `<li class="empty">Adicione rendimentos e despesas para ver seu fluxo do mes.</li>`;
    return;
  }
  list.innerHTML = state.transactions.map((item) => `
    <li class="transaction">
      <div>
        <strong>${typeLabels[item.kind]}</strong>
        <span>${item.category} ${item.description ? `- ${item.description}` : ""}</span>
      </div>
      <div class="transaction__amount ${item.kind === "income" ? "positive" : "negative"}">
        ${item.kind === "income" ? "+" : "-"}${money.format(Number(item.amount))}
        <button title="Excluir" aria-label="Excluir lancamento" data-delete="${item.id}">x</button>
      </div>
    </li>
  `).join("");
}

async function refresh() {
  const [me, summary, transactions] = await Promise.all([
    api("/api/me"),
    api("/api/summary"),
    api("/api/transactions"),
  ]);
  state.me = me;
  state.summary = summary;
  state.transactions = transactions;
  renderSummary();
  renderTransactions();
}

async function addTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.amount = Number(payload.amount);
  await api("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
  form.reset();
  form.occurred_on.value = today();
  await refresh();
}

async function askAssistant(event) {
  event.preventDefault();
  const input = document.querySelector("[name=message]");
  const answer = document.querySelector("[data-answer]");
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  answer.textContent = "Analisando seus dados...";
  try {
    const data = await api("/api/assistant", { method: "POST", body: JSON.stringify({ message: input.value }) });
    answer.textContent = data.answer;
    input.value = "";
    await refresh();
    if (data.requires_subscription) document.querySelector("[data-paywall]").showModal();
  } catch (error) {
    answer.textContent = "Nao foi possivel consultar a IA agora.";
  } finally {
    button.disabled = false;
  }
}

async function updateSubscription(event) {
  const is_subscribed = event.currentTarget.checked;
  state.me = await api("/api/me/subscription", { method: "PATCH", body: JSON.stringify({ is_subscribed }) });
  renderSummary();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  await api(`/api/transactions/${button.dataset.delete}`, { method: "DELETE" });
  await refresh();
});

document.querySelector("[data-transaction-form]").addEventListener("submit", addTransaction);
document.querySelector("[data-assistant-form]").addEventListener("submit", askAssistant);
document.querySelector("[data-subscription]").addEventListener("change", updateSubscription);
document.querySelector("[data-register-form]").addEventListener("submit", register);
document.querySelector("[data-login-form]").addEventListener("submit", login);
document.querySelector("[data-confirm-form]").addEventListener("submit", confirmEmail);
document.querySelectorAll("[data-oauth]").forEach((button) => {
  button.addEventListener("click", async () => {
    const data = await api(`/api/auth/oauth/${button.dataset.oauth}`);
    setAuthMessage(data.message);
  });
});
document.querySelector("[name=occurred_on]").value = today();
if (state.token) {
  showApp(true);
  refresh().catch(() => {
    localStorage.removeItem("finance_token");
    state.token = null;
    showApp(false);
  });
} else {
  showApp(false);
}
