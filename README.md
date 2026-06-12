# Assistente Financeiro

MVP de assistente financeiro em Python para navegador, Android e iOS via PWA. O projeto usa FastAPI, PostgreSQL, Docker e a API da OpenAI para um agente de apoio financeiro.

## Funcionalidades iniciais

- Cadastro de rendimentos.
- Cadastro de gastos mensais, variaveis, imprevistos e outras despesas.
- Resumo mensal com receitas, despesas, saldo, imprevistos e taxa de economia.
- Agente IA com limite gratuito mensal configuravel.
- Assinatura simulada para liberar o uso acima do limite.
- Interface responsiva instalavel como PWA em Android/iOS e navegadores.

## Como rodar

1. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

2. Edite `.env` e informe `OPENAI_API_KEY` para ativar a IA.

3. Suba os containers:

```bash
docker compose up --build
```

4. Acesse:

```text
http://localhost:8001
```

## Stack escolhida

- `FastAPI`: simples, rapido e bom para APIs Python.
- `PostgreSQL`: banco relacional robusto para dados financeiros.
- `PWA`: entrega web, Android e iOS no mesmo codigo inicial.
- `OpenAI Responses API`: endpoint recomendado pela documentacao atual da OpenAI para apps de geracao de texto.

## Proximos passos tecnicos

- Autenticacao real de usuarios.
- Migracoes com Alembic.
- Pagamento real com provedor como Stripe ou Mercado Pago.
- Metas de economia, orcamentos por categoria e alertas.
- Testes automatizados e pipeline CI.
- Criptografia/camadas extras de privacidade para dados sensiveis.
