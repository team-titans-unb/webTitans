# webTitans

Site da equipe de robótica **TITANS** (FCTE/UnB), construído com **Next.js (App Router)**.

## Pré-requisitos

- **Node.js 20.9+** (recomendado: 22 LTS). O Next.js 16 não roda em versões anteriores.
- **npm** (vem junto com o Node).

### Instalando o Node

**Windows** — baixe o instalador `.msi` em [nodejs.org](https://nodejs.org) ou use o nvm-windows.

**Linux/macOS** — via nvm:

```sh
# Baixa e instala o nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

# Recarrega o shell (ou abra um novo terminal):
\. "$HOME/.nvm/nvm.sh"

# Instala e usa o Node 22:
nvm install 22
nvm use 22

# Confirme as versões:
node -v   # v22.x
npm -v
```

## Executando localmente

```sh
# 1: Clone o repositório
git clone <url>
cd webTitans

# 2: Instale as dependências
npm install

# 3: Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação fica disponível em **http://localhost:3000** (com hot reload).

## Variáveis de ambiente

O formulário de feedback usa o EmailJS. Crie um arquivo **`.env.local`** na raiz com:

```sh
NEXT_PUBLIC_EMAILJS_SERVICE_ID=seu_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=seu_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=sua_public_key
```

> No Next, variáveis expostas ao navegador precisam do prefixo `NEXT_PUBLIC_`.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | Verifica o código com ESLint |

## Docker

Pré-requisito: ter o Docker instalado. No Windows/Linux:

```sh
winget install -e --id Docker.DockerDesktop
```

### Opção A — imagem de produção

```sh
# Build da imagem
docker build -t auth .

# Executa (a imagem expõe a porta 5000)
docker run -p 5000:8080 auth:latest
```

Acesse em **http://localhost:5000**.

### Opção B — desenvolvimento com docker compose

Sobe o `next dev` dentro do container, com o código montado por volume (hot reload via polling):

```sh
docker compose up
```

Acesse em **http://localhost:3000**.

## Tecnologias utilizadas

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Docker
