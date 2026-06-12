from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AIMessage, EmailVerificationToken, SessionToken, Transaction, TransactionType, User
from app.security import expires_in, hash_password, make_token, md5_digest, normalize_email, token_hash, utcnow, verify_password


def get_or_create_demo_user(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        return user
    normalized = normalize_email(email)
    user = User(email=normalized, email_md5=md5_digest(normalized), email_confirmed=True, consent_lgpd=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def register_user(db: Session, email: str, password: str, consent_lgpd: bool) -> tuple[User, str]:
    if not consent_lgpd:
        raise ValueError("consent_required")
    normalized = normalize_email(email)
    existing = db.scalar(select(User).where(User.email_md5 == md5_digest(normalized)))
    if existing:
        raise ValueError("email_exists")

    user = User(
        email=normalized,
        email_md5=md5_digest(normalized),
        password_hash=hash_password(password),
        auth_provider="email",
        email_confirmed=False,
        consent_lgpd=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    confirmation_token = create_email_verification_token(db, user)
    return user, confirmation_token


def create_email_verification_token(db: Session, user: User) -> str:
    raw_token = make_token()
    db.add(EmailVerificationToken(user_id=user.id, token_hash=token_hash(raw_token), expires_at=expires_in(24)))
    db.commit()
    return raw_token


def confirm_email(db: Session, raw_token: str) -> User | None:
    record = db.scalar(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash(raw_token),
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > utcnow(),
        )
    )
    if not record:
        return None
    user = db.get(User, record.user_id)
    if not user:
        return None
    user.email_confirmed = True
    record.used_at = utcnow()
    db.add_all([user, record])
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    normalized = normalize_email(email)
    user = db.scalar(select(User).where(User.email_md5 == md5_digest(normalized)))
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user: User) -> str:
    raw_token = make_token()
    db.add(SessionToken(user_id=user.id, token_hash=token_hash(raw_token), expires_at=expires_in(24 * 30)))
    db.commit()
    return raw_token


def user_from_session(db: Session, raw_token: str) -> User | None:
    session = db.scalar(
        select(SessionToken).where(
            SessionToken.token_hash == token_hash(raw_token),
            SessionToken.expires_at > utcnow(),
        )
    )
    if not session:
        return None
    return db.get(User, session.user_id)


def current_month_bounds(today: date | None = None) -> tuple[int, int]:
    today = today or date.today()
    return today.year, today.month


def summarize_month(db: Session, user: User) -> dict[str, Decimal | float | str]:
    year, month = current_month_bounds()
    rows = db.execute(
        select(Transaction.kind, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user.id,
            extract("year", Transaction.occurred_on) == year,
            extract("month", Transaction.occurred_on) == month,
        )
        .group_by(Transaction.kind)
    ).all()
    totals = {kind: Decimal(total) for kind, total in rows}
    income = totals.get(TransactionType.income.value, Decimal("0"))
    expenses = sum(
        amount
        for kind, amount in totals.items()
        if kind != TransactionType.income.value
    )
    unexpected = totals.get(TransactionType.unexpected_expense.value, Decimal("0"))
    balance = income - expenses
    savings_rate = float((balance / income) * 100) if income > 0 else 0.0
    return {
        "income": income,
        "expenses": expenses,
        "balance": balance,
        "unexpected": unexpected,
        "savings_rate": round(savings_rate, 1),
        "month": f"{year}-{month:02d}",
    }


def count_ai_messages_this_month(db: Session, user: User) -> int:
    year, month = current_month_bounds()
    return db.scalar(
        select(func.count(AIMessage.id)).where(
            AIMessage.user_id == user.id,
            extract("year", AIMessage.created_at) == year,
            extract("month", AIMessage.created_at) == month,
        )
    ) or 0


def build_financial_context(db: Session, user: User) -> str:
    summary = summarize_month(db, user)
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.occurred_on.desc(), Transaction.id.desc())
        .limit(30)
    ).all()
    lines = [
        f"Resumo do mes {summary['month']}:",
        f"Receitas: {summary['income']}",
        f"Despesas: {summary['expenses']}",
        f"Saldo: {summary['balance']}",
        f"Imprevistos: {summary['unexpected']}",
        f"Taxa de economia: {summary['savings_rate']}%",
        "Lancamentos recentes:",
    ]
    for item in transactions:
        lines.append(f"- {item.occurred_on} | {item.kind} | {item.category} | {item.amount} | {item.description}")
    return "\n".join(lines)


def ask_financial_assistant(db: Session, user: User, settings: Settings, message: str) -> str:
    if not settings.openai_api_key:
        return (
            "Configure OPENAI_API_KEY no arquivo .env para ativar a IA. "
            "Enquanto isso, acompanhe o saldo, reduza gastos imprevistos e revise categorias com maior peso no mes."
        )

    context = build_financial_context(db, user)
    payload = {
        "model": settings.openai_model,
        "input": [
            {
                "role": "developer",
                "content": (
                    "Voce e um assistente financeiro pessoal. Responda em portugues do Brasil, "
                    "seja pratico, nao prometa retorno financeiro e recomende procurar profissional "
                    "qualificado para decisoes financeiras complexas."
                ),
            },
            {
                "role": "user",
                "content": f"Dados financeiros do usuario:\n{context}\n\nPergunta: {message}",
            },
        ],
    }
    response = httpx.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=45,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("output_text"):
        return data["output_text"]

    parts: list[str] = []
    for output in data.get("output", []):
        for content in output.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                parts.append(content["text"])
    return "\n".join(parts).strip() or "Nao consegui gerar uma resposta agora."
