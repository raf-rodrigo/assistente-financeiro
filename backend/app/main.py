from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import Base, engine, get_db
from app.models import AIMessage, Transaction
from app.schemas import (
    AskRequest,
    AskResponse,
    AuthResponse,
    ConfirmEmailRequest,
    LoginRequest,
    RegisterRequest,
    SubscriptionUpdate,
    Summary,
    TransactionCreate,
    TransactionRead,
    UserRead,
)
from app.services import (
    ask_financial_assistant,
    authenticate_user,
    confirm_email,
    count_ai_messages_this_month,
    create_session,
    register_user,
    summarize_month,
    user_from_session,
)

Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_md5 VARCHAR(32)")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) DEFAULT 'email'")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_subject_hash VARCHAR(64)")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_lgpd BOOLEAN DEFAULT false")
    connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(20) DEFAULT '2026-06-12'")

app = FastAPI(title="Assistente Financeiro", version="0.1.0")
static_dir = Path("static")
assets_dir = static_dir / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


def current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Autenticacao obrigatoria")
    user = user_from_session(db, authorization.removeprefix("Bearer ").strip())
    if not user:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada")
    if not user.email_confirmed:
        raise HTTPException(status_code=403, detail="Confirme seu email antes de continuar")
    return user


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/privacidade")
def privacy():
    return FileResponse("static/index.html")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse("static/manifest.webmanifest", media_type="application/manifest+json")


@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user, confirmation_token = register_user(db, payload.email, payload.password, payload.consent_lgpd)
    except ValueError as exc:
        if str(exc) == "consent_required":
            raise HTTPException(status_code=400, detail="Consentimento de privacidade obrigatorio") from exc
        if str(exc) == "email_exists":
            raise HTTPException(status_code=409, detail="Email ja cadastrado") from exc
        raise
    return AuthResponse(
        email=user.email,
        email_confirmed=user.email_confirmed,
        message="Conta criada. Em producao, o token abaixo sera enviado por email.",
        confirmation_token=confirmation_token,
    )


@app.post("/api/auth/confirm-email", response_model=AuthResponse)
def confirm_email_route(payload: ConfirmEmailRequest, db: Session = Depends(get_db)):
    user = confirm_email(db, payload.token)
    if not user:
        raise HTTPException(status_code=400, detail="Token invalido ou expirado")
    session_token = create_session(db, user)
    return AuthResponse(
        token=session_token,
        email=user.email,
        email_confirmed=user.email_confirmed,
        message="Email confirmado",
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha invalidos")
    if not user.email_confirmed:
        raise HTTPException(status_code=403, detail="Confirme seu email antes de entrar")
    session_token = create_session(db, user)
    return AuthResponse(token=session_token, email=user.email, email_confirmed=True, message="Login realizado")


@app.get("/api/auth/oauth/{provider}")
def oauth_placeholder(provider: str):
    if provider not in {"google", "apple"}:
        raise HTTPException(status_code=404, detail="Provedor nao suportado")
    return {
        "provider": provider,
        "message": "Configure OAuth/OIDC em producao. O banco ja possui estrutura para vincular identidade externa por subject hash.",
    }


@app.get("/api/me", response_model=UserRead)
def me(user=Depends(current_user), db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return {
        "email": user.email,
        "email_confirmed": user.email_confirmed,
        "is_subscribed": user.is_subscribed,
        "free_limit": settings.free_ai_messages_per_month,
        "used_this_month": count_ai_messages_this_month(db, user),
    }


@app.patch("/api/me/subscription", response_model=UserRead)
def update_subscription(
    payload: SubscriptionUpdate,
    user=Depends(current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    user.is_subscribed = payload.is_subscribed
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "email": user.email,
        "email_confirmed": user.email_confirmed,
        "is_subscribed": user.is_subscribed,
        "free_limit": settings.free_ai_messages_per_month,
        "used_this_month": count_ai_messages_this_month(db, user),
    }


@app.get("/api/transactions", response_model=list[TransactionRead])
def list_transactions(user=Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.occurred_on.desc(), Transaction.id.desc())
        .limit(120)
    ).all()


@app.post("/api/transactions", response_model=TransactionRead)
def create_transaction(payload: TransactionCreate, user=Depends(current_user), db: Session = Depends(get_db)):
    transaction = Transaction(user_id=user.id, **payload.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@app.delete("/api/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado")
    db.delete(transaction)
    db.commit()


@app.get("/api/summary", response_model=Summary)
def summary(user=Depends(current_user), db: Session = Depends(get_db)):
    return summarize_month(db, user)


@app.post("/api/assistant", response_model=AskResponse)
def assistant(
    payload: AskRequest,
    user=Depends(current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    used = count_ai_messages_this_month(db, user)
    if not user.is_subscribed and used >= settings.free_ai_messages_per_month:
        return AskResponse(
            answer="Voce atingiu o limite gratuito mensal. Assine para continuar usando a IA neste mes.",
            remaining_free_messages=0,
            requires_subscription=True,
        )

    answer = ask_financial_assistant(db, user, settings, payload.message)
    db.add(AIMessage(user_id=user.id, prompt=payload.message, answer=answer))
    db.commit()

    remaining = None if user.is_subscribed else max(settings.free_ai_messages_per_month - used - 1, 0)
    return AskResponse(answer=answer, remaining_free_messages=remaining)
