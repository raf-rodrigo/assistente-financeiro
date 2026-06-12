# Assistente Financeiro

MVP de assistente financeiro em Python para navegador, Android e iOS via PWA. O projeto usa FastAPI, PostgreSQL, Docker e a API da OpenAI para um agente de apoio financeiro.

## Funcionalidades iniciais

- Criacao de conta por email/senha com confirmacao de email.
- Estrutura preparada para login por Google e Apple via OAuth/OIDC.
- Cadastro de rendimentos.
- Cadastro de gastos mensais, variaveis, imprevistos e outras despesas.
- Resumo mensal com receitas, despesas, saldo, imprevistos e taxa de economia.
- Agente IA com limite gratuito mensal configuravel.
- Assinatura simulada para liberar o uso acima do limite.
- Interface responsiva instalavel como PWA em Android/iOS e navegadores.

## Privacidade, LGPD e senhas

Este projeto ja evita o modelo demo anonimo e separa os dados financeiros por usuario autenticado. Para alinhar a aplicacao aos principios da LGPD, a base inicial aplica:

- Coleta minima de dados pessoais para conta: email, consentimento, provedor de login e status de confirmacao.
- Senha armazenada com PBKDF2-SHA256 com salt; senha nunca deve ser armazenada em texto puro nem em MD5.
- `email_md5` como identificador auxiliar/pseudonimizado para busca e deduplicacao. MD5 nao e criptografia e nao deve ser considerado protecao forte para dados pessoais.
- Tokens de sessao e confirmacao salvos apenas como SHA-256.
- Consentimento de privacidade obrigatorio no cadastro.
- Politica de privacidade inicial disponivel em `/privacidade`.
- Estrutura para atender direitos do titular em etapa futura: acesso, correcao, exclusao e portabilidade.

Conformidade LGPD completa tambem exige politica de privacidade, base legal documentada, retencao de dados, logs de auditoria, processo de exclusao, controle de compartilhamento com OpenAI/provedores, seguranca operacional e revisao juridica.

Referencia oficial: Lei nº 13.709/2018, LGPD, no Planalto.

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

- Envio real de email transacional para confirmacao.
- OAuth/OIDC real com Google e Apple.
- Migracoes com Alembic.
- Pagamento real com provedor como Stripe ou Mercado Pago.
- Metas de economia, orcamentos por categoria e alertas.
- Testes automatizados e pipeline CI.
- Criptografia/camadas extras de privacidade para dados sensiveis.

## Como criar a chave da OpenAI API

1. Acesse https://platform.openai.com/api-keys
2. Entre com sua conta OpenAI.
3. Clique em `Create new secret key`.
4. Copie a chave gerada.
5. No arquivo `.env`, preencha:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5.5
```

6. Reinicie a aplicacao para carregar a nova variavel:

```bash
docker compose up -d
```

7. Acesse a aplicacao e use o agente IA:

```text
http://localhost:8001
```

Importante: nunca publique a chave da OpenAI em repositorios, prints, mensagens ou logs. O arquivo `.env` ja esta no `.gitignore`; mantenha a chave apenas no ambiente local ou no gerenciador de segredos do ambiente de producao.
