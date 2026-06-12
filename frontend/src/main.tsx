import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, CalendarDays, Trash2 } from "lucide-react";
import { api, getToken, setToken } from "./api";
import type { AskResponse, AuthResponse, Summary, Transaction, TransactionKind, User } from "./types";
import "./styles.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const typeLabels: Record<TransactionKind, string> = {
  income: "Rendimento",
  fixed_expense: "Gasto mensal",
  variable_expense: "Gasto variavel",
  unexpected_expense: "Imprevisto",
  other_expense: "Outra despesa",
};

const emptySummary: Summary = {
  income: "0",
  expenses: "0",
  balance: "0",
  unexpected: "0",
  savings_rate: 0,
  month: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.4-4.5 3.4-7.7z" />
      <path fill="#34a853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.1 1-3.9 1-3 0-5.6-2-6.5-4.8H2v2.7C3.8 20.4 7.6 23 12 23z" />
      <path fill="#fbbc05" d="M5.5 13.9c-.2-.6-.4-1.3-.4-1.9s.1-1.3.4-1.9V7.4H2C1.3 8.8 1 10.3 1 12s.3 3.2 1 4.6l3.5-2.7z" />
      <path fill="#ea4335" d="M12 5.3c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.6 1 3.8 3.6 2 7.4l3.5 2.7C6.4 7.3 9 5.3 12 5.3z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.4 1.6c.1 1.1-.3 2.1-1 2.9-.8.9-1.8 1.4-2.8 1.3-.1-1 .3-2.1 1-2.8.7-.8 1.9-1.4 2.8-1.4zM20.2 17.5c-.4.9-.7 1.4-1.2 2.2-.8 1.2-1.9 2.7-3.3 2.7-1.2 0-1.6-.8-3.3-.8s-2.1.8-3.3.8c-1.4.1-2.5-1.6-3.3-2.8-2.3-3.4-2.5-7.4-1.1-9.5 1-1.5 2.5-2.4 3.9-2.4 1.5 0 2.4.8 3.6.8 1.2 0 1.9-.8 3.6-.8 1.3 0 2.7.7 3.7 1.9-3.2 1.7-2.7 6.3.1 7.9z" />
    </svg>
  );
}

function PrivacyPage() {
  return (
    <main className="legal">
      <a className="back-link" href="/">Voltar</a>
      <header className="legal__header">
        <p>Assistente Financeiro</p>
        <h1>Politica de Privacidade</h1>
        <span>Versao inicial para desenvolvimento - 12/06/2026</span>
      </header>
      <section className="legal__content">
        <h2>1. Objetivo</h2>
        <p>Esta politica explica como o Assistente Financeiro coleta, usa, armazena e protege dados pessoais necessarios para criar a conta, registrar informacoes financeiras e oferecer apoio por IA.</p>
        <h2>2. Dados coletados</h2>
        <p>Podemos coletar email, senha protegida por hash, status de confirmacao do email, consentimento de privacidade, dados de assinatura, registros financeiros informados pelo usuario, perguntas enviadas ao agente IA e respostas geradas.</p>
        <h2>3. Uso dos dados</h2>
        <p>Os dados sao usados para autenticar o usuario, separar os lancamentos por conta, calcular resumos financeiros, controlar limite gratuito de IA, permitir assinatura e gerar respostas do agente financeiro.</p>
        <h2>4. Protecao e pseudonimizacao</h2>
        <p>Senhas nao sao armazenadas em texto puro. A aplicacao usa hash seguro com salt para senhas, hash SHA-256 para tokens e MD5 apenas como identificador auxiliar de busca do email. MD5 nao e criptografia e nao deve ser considerado protecao forte de dados pessoais.</p>
        <h2>5. Compartilhamento com OpenAI</h2>
        <p>Quando o usuario utiliza o agente IA, informacoes financeiras necessarias para responder a pergunta podem ser enviadas para a API da OpenAI. O usuario deve evitar inserir dados excessivos ou desnecessarios nas perguntas.</p>
        <h2>6. Direitos do titular</h2>
        <p>O usuario podera solicitar acesso, correcao, exclusao, portabilidade e informacoes sobre o tratamento dos seus dados. Estes fluxos ainda devem ser implementados no produto antes do uso em producao.</p>
        <h2>7. Retencao</h2>
        <p>Os dados serao mantidos enquanto a conta estiver ativa ou enquanto forem necessarios para cumprir obrigacoes legais, contratuais, de seguranca ou auditoria. A politica de retencao detalhada ainda deve ser definida antes da producao.</p>
        <h2>8. Contato</h2>
        <p>Antes do lancamento publico, informe aqui o canal oficial para solicitacoes de privacidade e protecao de dados.</p>
        <h2>9. Observacao importante</h2>
        <p>Este documento e um rascunho tecnico inicial. Ele nao substitui revisao juridica, definicao formal de controlador/operador, base legal, relatorio de impacto, politica de retencao e procedimentos internos exigidos para conformidade LGPD.</p>
      </section>
    </main>
  );
}

function AuthView({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      email: String(data.get("email") || ""),
      password: String(data.get("password") || ""),
    };

    try {
      if (mode === "register") {
        const response = await api<AuthResponse>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ ...payload, consent_lgpd: data.get("consent_lgpd") === "on" }),
        });
        setConfirmationToken(response.confirmation_token || "");
        setMessage("Conta criada. Em producao esse token sera enviado por email; no dev ele foi preenchido abaixo.");
      } else {
        const response = await api<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setToken(response.token);
        await onAuthenticated();
      }
    } catch {
      setMessage(mode === "register" ? "Nao foi possivel criar a conta. Verifique se o email ja existe." : "Login invalido ou email ainda nao confirmado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData(event.currentTarget);
      const response = await api<AuthResponse>("/api/auth/confirm-email", {
        method: "POST",
        body: JSON.stringify({ token: String(data.get("token") || "") }),
      });
      setToken(response.token);
      await onAuthenticated();
    } catch {
      setMessage("Token invalido ou expirado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    const response = await api<{ message: string }>(`/api/auth/oauth/${provider}`);
    setMessage(response.message);
  }

  return (
    <section className="auth">
      <div className="auth__intro">
        <p>Assistente Financeiro</p>
        <h1>Entre para acessar seus dados financeiros</h1>
        <span>Dados pessoais minimos, senha com hash seguro e confirmacao de email antes do uso.</span>
      </div>
      <section className="panel auth-card">
        <div className="panel__title">
          <h2>{mode === "register" ? "Criar conta" : "Entrar"}</h2>
          <span>{mode === "register" ? "Confirme o email" : "Email e senha"}</span>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Acesso">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Cadastrar</button>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          <label>Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>Senha
            <input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required />
          </label>
          {mode === "register" && (
            <label className="check">
              <input name="consent_lgpd" type="checkbox" required />
              <span>Li e aceito a <a href="/privacidade" target="_blank" rel="noopener">politica de privacidade</a> e o tratamento dos meus dados para uso do assistente financeiro.</span>
            </label>
          )}
          <button type="submit" disabled={isSubmitting}>{mode === "register" ? "Cadastrar" : "Entrar"}</button>
        </form>
        <div className="auth-divider"><span>ou continue com</span></div>
        <div className="oauth-row">
          <button type="button" className="oauth-button" onClick={() => oauth("google")} aria-label="Entrar com Google"><GoogleIcon /><span>Google</span></button>
          <button type="button" className="oauth-button" onClick={() => oauth("apple")} aria-label="Entrar com Apple"><AppleIcon /><span>Apple</span></button>
        </div>
        {confirmationToken && (
          <form className="confirm-form" onSubmit={confirmEmail}>
            <div className="panel__title compact">
              <h2>Confirmar email</h2>
              <span>Ambiente dev</span>
            </div>
            <label>Token recebido por email
              <input name="token" defaultValue={confirmationToken} required />
            </label>
            <button type="submit" disabled={isSubmitting}>Confirmar e entrar</button>
          </form>
        )}
        <p className="auth-message">{message}</p>
      </section>
    </section>
  );
}

function Dashboard({ user, summary, transactions, onRefresh }: {
  user: User;
  summary: Summary;
  transactions: Transaction[];
  onRefresh: () => Promise<void>;
}) {
  const [assistantAnswer, setAssistantAnswer] = useState("Registre alguns lancamentos e peca uma analise do seu mes.");
  const [isAsking, setIsAsking] = useState(false);

  const usage = user.is_subscribed ? "Plano ativo" : `${user.used_this_month}/${user.free_limit} perguntas gratis`;

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        kind: data.get("kind"),
        category: data.get("category"),
        description: data.get("description") || "",
        amount: Number(data.get("amount")),
        occurred_on: data.get("occurred_on"),
      }),
    });
    form.reset();
    const dateInput = form.elements.namedItem("occurred_on") as HTMLInputElement;
    dateInput.value = today();
    await onRefresh();
  }

  async function deleteTransaction(id: number) {
    await api<null>(`/api/transactions/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  async function updateSubscription(is_subscribed: boolean) {
    await api<User>("/api/me/subscription", { method: "PATCH", body: JSON.stringify({ is_subscribed }) });
    await onRefresh();
  }

  async function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsAsking(true);
    setAssistantAnswer("Analisando seus dados...");
    try {
      const response = await api<AskResponse>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: data.get("message") }),
      });
      setAssistantAnswer(response.answer);
      form.reset();
      await onRefresh();
    } catch {
      setAssistantAnswer("Nao foi possivel consultar a IA agora.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p>Assistente Financeiro</p>
          <h1>Controle seus rendimentos, gastos e imprevistos</h1>
        </div>
        <label className="switch">
          <input type="checkbox" checked={user.is_subscribed} onChange={(event) => updateSubscription(event.target.checked)} />
          <span>Assinar IA</span>
        </label>
      </header>
      <main className="shell">
        <section className="metrics" aria-label="Resumo financeiro">
          <article><span>Rendimentos</span><strong>{money.format(Number(summary.income))}</strong></article>
          <article><span>Despesas</span><strong>{money.format(Number(summary.expenses))}</strong></article>
          <article><span>Saldo</span><strong>{money.format(Number(summary.balance))}</strong></article>
          <article><span>Imprevistos</span><strong>{money.format(Number(summary.unexpected))}</strong></article>
          <article><span>Economia</span><strong>{Number(summary.savings_rate).toFixed(1)}%</strong></article>
        </section>
        <section className="workspace">
          <form className="panel entry" onSubmit={addTransaction}>
            <div className="panel__title">
              <h2>Novo lancamento</h2>
              <span>{usage}</span>
            </div>
            <label>Tipo
              <select name="kind" required>
                <option value="income">Rendimento</option>
                <option value="fixed_expense">Gasto mensal</option>
                <option value="variable_expense">Gasto variavel</option>
                <option value="unexpected_expense">Gasto imprevisto</option>
                <option value="other_expense">Outra despesa</option>
              </select>
            </label>
            <div className="field-row">
              <label>Categoria
                <input name="category" required placeholder="Salario, aluguel, mercado" />
              </label>
              <label>Valor
                <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" />
              </label>
            </div>
            <label>Descricao
              <input name="description" placeholder="Opcional" />
            </label>
            <label>Data
              <input name="occurred_on" type="date" required defaultValue={today()} />
            </label>
            <button type="submit">Adicionar</button>
          </form>
          <section className="panel assistant">
            <div className="panel__title">
              <h2><Bot size={18} /> Agente IA</h2>
              <span>OpenAI</span>
            </div>
            <form className="chatbox" onSubmit={askAssistant}>
              <textarea name="message" required minLength={4} maxLength={1200} placeholder="Ex: onde posso reduzir gastos este mes?" />
              <button type="submit" disabled={isAsking}>Perguntar</button>
            </form>
            <p className="answer">{assistantAnswer}</p>
          </section>
        </section>
        <section className="panel ledger">
          <div className="panel__title">
            <h2><CalendarDays size={18} /> Ultimos lancamentos</h2>
            <span>Mes atual e historico recente</span>
          </div>
          <ul>
            {transactions.length === 0 && <li className="empty">Adicione rendimentos e despesas para ver seu fluxo do mes.</li>}
            {transactions.map((item) => (
              <li className="transaction" key={item.id}>
                <div>
                  <strong>{typeLabels[item.kind]}</strong>
                  <span>{item.category} {item.description ? `- ${item.description}` : ""}</span>
                </div>
                <div className={`transaction__amount ${item.kind === "income" ? "positive" : "negative"}`}>
                  {item.kind === "income" ? "+" : "-"}{money.format(Number(item.amount))}
                  <button title="Excluir" aria-label="Excluir lancamento" onClick={() => deleteTransaction(item.id)} type="button"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const isPrivacy = useMemo(() => window.location.pathname === "/privacidade", []);

  async function refresh() {
    const [me, nextSummary, nextTransactions] = await Promise.all([
      api<User>("/api/me"),
      api<Summary>("/api/summary"),
      api<Transaction[]>("/api/transactions"),
    ]);
    setUser(me);
    setSummary(nextSummary);
    setTransactions(nextTransactions);
  }

  useEffect(() => {
    if (isPrivacy) return;
    if (!getToken()) return;
    refresh().catch(() => {
      setToken(null);
      setUser(null);
    });
  }, [isPrivacy]);

  if (isPrivacy) return <PrivacyPage />;
  if (!user) return <AuthView onAuthenticated={refresh} />;
  return <Dashboard user={user} summary={summary} transactions={transactions} onRefresh={refresh} />;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
