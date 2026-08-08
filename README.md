# TH Bombas - MVP1

Sistema de Gestão Integrada para TH Bombas com suporte a múltiplos perfis de usuário:
- **ADM Master** - Gestão geral, financeira e usuários
- **Vendedor Interno** - PDV e estoque
- **Vendedor Externo** - Catálogo e pedidos
- **Técnico/Funcionário Condominial** - Ordens de serviço e manutenção

---

## 🚀 Quick Start

### 1. Instalação

```bash
make install
# ou manualmente:
# npm install --prefix frontend
# npm install --prefix backend
```

### 2. Desenvolvimento

**Iniciar frontend + backend juntos:**
```bash
make dev
```

Ou separados:
```bash
make dev-frontend   # Frontend em http://localhost:5173
make dev-backend    # Backend em http://localhost:3000
```

### 3. Build

```bash
make build
```

### 4. Limpeza

```bash
make clean
```

---

## 📁 Estrutura do Projeto

```
projeto_th_piscinas/
├── frontend/                 # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── api/             # Cliente HTTP
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── pages/           # Páginas por módulo
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Contextos e utilitários
│   │   ├── App.jsx          # Rotas
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                  # Node.js + Express (a ser criado)
│   ├── src/
│   │   ├── api/             # Rotas e controllers
│   │   ├── middleware/      # Autenticação, CORS
│   │   ├── db/              # Prisma schema e migrations
│   │   └── index.js         # Express app
│   ├── package.json
│   └── .env.example
│
├── Makefile                  # Comandos de desenvolvimento
├── package.json              # Scripts raiz
├── README.md                 # Este arquivo
└── requisitos_mvp1.md        # Requisitos do MVP
```

---

## 🔑 Principais Tecnologias

### Frontend
- **React 18** - UI framework
- **Vite 6** - Build tool ultrarrápido
- **React Router v6** - Roteamento
- **TailwindCSS 3** - Estilização
- **shadcn/ui** - Componentes prontos
- **TanStack Query 5** - Data fetching
- **React Hook Form + Zod** - Formulários com validação
- **Framer Motion** - Animações
- **Recharts** - Gráficos

### Backend (Recomendado)
- **Express 4** - Framework web
- **Prisma 5** - ORM
- **PostgreSQL** ou **SQLite** - Banco de dados
- **JWT** - Autenticação

---

## 🔐 Autenticação

**Fluxo:**
1. Login com matrícula + senha
2. Backend retorna JWT
3. JWT armazenado em `localStorage`
4. Incluído em headers das requisições

**Perfis (roles):**
- `admin` - Acesso completo
- `vendedor_interno` - PDV, estoque
- `vendedor_externo` - Catálogo, pedidos
- `tecnico` - Ordens de serviço

---

## 📊 Endpoints Esperados (Backend)

### Autenticação
- `POST /api/auth/login` - Login com matrícula
- `GET /api/auth/me` - Dados do usuário autenticado
- `POST /api/auth/logout` - Logout

### Usuários (admin)
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Produtos
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`

### Vendas
- `GET /api/sales`
- `POST /api/sales`
- `GET /api/sales/:id`
- `DELETE /api/sales/:id`

### Clientes
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `GET /api/clients/:id`

### Ordens de Serviço
- `GET /api/service-orders`
- `POST /api/service-orders`
- `PUT /api/service-orders/:id`

---

## 🧪 Testes

```bash
# Frontend
cd frontend && npm run test

# Backend
cd backend && npm run test
```

---

## 📝 Variáveis de Ambiente

### Frontend (`.env.local`)
```env
VITE_API_URL=http://localhost:3000
```

### Backend (`.env`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db
JWT_SECRET=sua_chave_secreta_aqui
```

---

## 📖 Documentação

- **[Requisitos MVP1](./requisitos_mvp1.md)** - Especificação completa de funcionalidades
- **[Plano de Implementação](./.claude/plans/majestic-discovering-music.md)** - Fases e roadmap
- **[Protótipo](./)** - Pasta `th-flow-pro` com design referência

---

## 👥 Perfis de Acesso

### ADM Master
- Dashboard com gráficos
- Gestão de usuários (criar, editar, resetar senha)
- Validação de clientes
- Validação de ordens de serviço
- Gestão de estoque
- Emissão de NFS-e
- Acompanhamento financeiro

### Vendedor Interno
- PDV (busca por código de barras ou nome)
- Carrinho e confirmação de venda
- Cancelamento de venda (requer senha admin)
- Gestão de produtos
- Entrada de estoque
- Cadastro de fornecedores

### Vendedor Externo
- Lista de clientes
- Cadastro de novo cliente (aguarda aprovação)
- Catálogo de produtos com estoque
- Carrinho de pedidos
- Histórico de pedidos

### Técnico/Funcionário Condominial
- Agenda de serviços
- Criação e execução de orçamentos
- Registro de serviço com fotos
- Histórico de clientes
- Histórico de atividades

---

## ⏱️ Timeout de Sessão

A sessão é encerrada automaticamente após **30 minutos de inatividade**. Eventos de reset:
- Clique do mouse
- Digitação
- Touch (mobile)
- Scroll

---

## 🛠️ Desenvolvimento

### Rodando localmente

1. **Clone/abra o projeto**
   ```bash
   cd projeto_th_piscinas
   ```

2. **Instale as dependências**
   ```bash
   make install
   ```

3. **Inicie dev servers**
   ```bash
   make dev
   ```

4. **Abra o navegador**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

### Padrões de Código

- **Componentes:** PascalCase (`UserForm.jsx`)
- **Hooks:** camelCase com prefixo `use` (`useAuth.js`)
- **Páginas:** PascalCase com sufixo `Page` (`DashboardPage.jsx`)
- **Arquivos utilitários:** camelCase (`utils.js`, `constants.js`)

### Commits

Use o padrão convencional:
```
feat: adiciona PDV para vendedor interno
fix: corrige validação de login
docs: atualiza README
refactor: simplifica AuthContext
```

---

## 📱 Responsividade

O projeto é **100% responsivo**:
- Desktop: Sidebar fixa + conteúdo fluido
- Mobile: Header + Menu lateral colapsável

---

## 🚨 Troubleshooting

### Porta 3000 ou 5173 já em uso?

**Frontend:**
```bash
cd frontend && npm run dev -- --port 5174
```

**Backend:**
```bash
PORT=3001 node src/index.js
```

### Dependências desatualizadas?

```bash
make clean
make install
```

### Erro de CORS?

Certifique-se que o backend tem CORS configurado:
```javascript
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:5173' }));
```

---

## 📝 Checklist de Setup

- [ ] Node.js 18+ instalado (`node --version`)
- [ ] `make` instalado (Windows: Git Bash ou WSL)
- [ ] Executou `make install`
- [ ] Frontend inicia em `make dev-frontend`
- [ ] Backend está pronto para iniciar (criar em paralelo)
- [ ] Variáveis `.env` configuradas
- [ ] Banco de dados criado (SQLite ou PostgreSQL)

---

## 📞 Suporte

Para dúvidas sobre o projeto, abra uma issue ou consulte a documentação de requisitos.

---

**Versão:** 1.0.0  
**Última atualização:** 04/06/2026
