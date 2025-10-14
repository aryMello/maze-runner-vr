#!/bin/bash

echo "🔧 REORGANIZANDO ESTRUTURA DO PROJETO"
echo "======================================"
echo ""

# Verificar se estamos na pasta correta
if [ ! -d "public" ]; then
    echo "❌ Erro: Pasta 'public' não encontrada!"
    echo "   Execute este script na pasta raiz do projeto (onde está a pasta public)"
    exit 1
fi

echo "✅ Pasta 'public' encontrada"
echo ""

# Criar estrutura de pastas
echo "📁 Criando estrutura de pastas..."
mkdir -p frontend/public
mkdir -p backend

echo "✅ Pastas criadas:"
echo "   - frontend/"
echo "   - frontend/public/"
echo "   - backend/"
echo ""

# Mover arquivos do frontend
echo "📦 Movendo arquivos do FRONTEND..."

# Mover pasta public
if [ -d "public" ]; then
    cp -r public/* frontend/public/
    echo "   ✅ Copiado: public/* → frontend/public/"
fi

# Mover server.js do frontend (se existir e for o correto)
if [ -f "server.js" ]; then
    # Verificar se é o server do frontend (procura por 'static')
    if grep -q "static" server.js; then
        cp server.js frontend/server.js
        echo "   ✅ Copiado: server.js → frontend/server.js"
    fi
fi

# Mover package.json do frontend
if [ -f "package.json" ]; then
    # Verificar se é do frontend (procura por 'express')
    if grep -q "express" package.json && ! grep -q "socket.io" package.json; then
        cp package.json frontend/package.json
        echo "   ✅ Copiado: package.json → frontend/package.json"
    fi
fi

# Mover .env
if [ -f ".env" ]; then
    cp .env frontend/.env
    echo "   ✅ Copiado: .env → frontend/.env"
fi

# Mover README
if [ -f "README.md" ]; then
    cp README.md frontend/README.md
    echo "   ✅ Copiado: README.md → frontend/README.md"
fi

echo ""

# Mover arquivos do backend
echo "📦 Movendo arquivos do BACKEND..."

# Mover test-connection.js
if [ -f "test-connection.js" ]; then
    cp test-connection.js backend/test-connection.js
    echo "   ✅ Copiado: test-connection.js → backend/test-connection.js"
fi

echo ""

# Criar .env do backend
echo "⚙️  Criando arquivos de configuração..."

cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
EOF
echo "   ✅ Criado: backend/.env"

cat > frontend/.env.example << 'EOF'
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3001
EOF
echo "   ✅ Criado: frontend/.env.example"

cat > backend/.env.example << 'EOF'
NODE_ENV=development
PORT=3001
EOF
echo "   ✅ Criado: backend/.env.example"

echo ""

# Criar .gitignore na raiz
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*/node_modules/

# Environment
.env
*/.env

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
EOF
echo "   ✅ Criado: .gitignore (raiz)"

echo ""
echo "✅ REORGANIZAÇÃO CONCLUÍDA!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1️⃣  Copie o código do backend/server.js"
echo "    (Artifact: backend_server_complete)"
echo ""
echo "2️⃣  Copie o código do backend/package.json"
echo "    (Artifact: backend_package_json)"
echo ""
echo "3️⃣  Atualize o frontend/package.json"
echo "    (Artifact: package_json_cross_platform)"
echo ""
echo "4️⃣  Instale as dependências:"
echo "    cd frontend && npm install"
echo "    cd ../backend && npm install"
echo ""
echo "5️⃣  Rode o projeto:"
echo "    cd ../frontend"
echo "    npm run dev:local"
echo ""
echo "6️⃣  Acesse: http://localhost:3000"
echo ""
echo "🎮 Boa sorte!"