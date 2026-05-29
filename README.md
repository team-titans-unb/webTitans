# Comandos para executar localmente

```sh
# 1: Clone o repo
git clone <url>

obs passos 2 e 3 n são obrigatórios

# 2: virtualize o ambiente com o python
python -m venv venv

# 3: ative o ambiente virtual
venv/Scripts/activate no windows, atente de habilitar a execução de scripts
source venv/bin/activate no linux

obs necessário ter o npm na sua máquina

instale o .msi no windows

no linux basta seguir esse passo a passo:

# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 24

# Verify the Node.js version:
node -v # Should print "v24.15.0".

# Verify npm version:
npm -v # Should print "11.12.1".

com o npm instalado, continue:

# 4: dependencias
npm i

# 5: inicie o ambiente local
npm run dev
```

## tecnologias utilizadas:

- node.js
- python
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Docker

windows

winget install -e --id Docker.DockerDesktop

