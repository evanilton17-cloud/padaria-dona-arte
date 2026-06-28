# 🥖 Padaria Online — Resumo Técnico Completo

## O que é
Sistema de cardápio online + painel admin para padarias.
- Cliente: vê cardápio, monta carrinho, escolhe entrega/retirada, paga no local
- Admin: gerencia pedidos em tempo real, produtos, categorias, configurações

## Tecnologias
- **Backend:** Node.js + Express
- **Frontend:** HTML puro + CSS + JS (sem frameworks)
- **Banco:** JSON (arquivo), lido/escrito via `fs`
- **Upload:** Multer (fotos)
- **Deploy:** Fly.io (Docker + volume persistente)
- **Auth:** Token UUID via `crypto.randomUUID()`, armazenado em Set no servidor

## Estrutura de Pastas
```
C:\PadariaDonaArte\
├── server.js           # Tudo: API, auth, upload, initDB, rotas
├── public/index.html   # Site público (cardápio, carrinho, checkout)
├── admin/index.html    # Painel admin (dashboard, pedidos, produtos, configs)
├── data/
│   ├── db.json         # Banco de dados (tudo num JSON só)
│   └── uploads/        # Fotos dos produtos
├── Dockerfile          # Container para Fly.io
├── fly.toml            # Config do Fly.io (nome, região, volume, porta)
├── fly.example.toml    # Template genérico para novos deploys
├── package.json
├── README.md           # Manual em português
├── setup.ps1           # Script de instalação rápida
├── .gitignore
└── RESUMO.md           # Este arquivo
```

## server.js — Endpoints da API

### Públicos (sem auth)
| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/products` | Listar produtos |
| GET | `/api/categories` | Listar categorias |
| GET | `/api/orders` | Listar pedidos (filtrados: só do dia ou admin vê todos) |
| POST | `/api/orders` | Criar pedido (body: client, phone, type, address, items, pay, total, obs) |
| GET | `/api/settings` | Pegar configs da loja |
| GET | `/api/horarios` | Pegar horários |
| GET | `/api/stats` | Estatísticas do dashboard |

### Autenticados (header `x-admin-token`)
| Método | Rota | Função |
|--------|------|--------|
| POST | `/api/admin/login` | Login (body: password) → retorna token |
| PATCH | `/api/products/:id` | Editar produto |
| PATCH | `/api/products/:id/toggle` | Ativar/desativar produto |
| DELETE | `/api/products/:id` | Deletar produto |
| POST | `/api/products` | Criar produto |
| POST | `/api/products/upload` | Upload de foto |
| POST | `/api/categories` | Criar categoria |
| DELETE | `/api/categories/:id` | Deletar categoria |
| PATCH | `/api/orders/:id/status` | Avançar status do pedido |
| DELETE | `/api/orders/:id` | Cancelar pedido |
| PUT | `/api/settings` | Salvar configs da loja |
| PUT | `/api/horarios` | Salvar horários |

### Auth middleware (server.js ~linha 73)
```js
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) return res.status(401).json({ error: 'Não autorizado' });
  next();
}
```

### Login (server.js ~linha 88)
```js
app.post('/api/admin/login', (req, res) => {
  const db = readDB();
  if (req.body.password !== db.storeSettings.adminPassword)
    return res.json({ success: false });
  const token = crypto.randomUUID();
  adminTokens.add(token);
  res.json({ success: true, token });
});
```

### initDB (server.js ~linha 25)
- Executa na inicialização
- Cria `data/`, `data/uploads/`, `data/db.json` se não existirem
- db.json default: `{ products: [], categories: [], orders: [], storeSettings: {...}, horarios: [...], orderCounter: 1000 }`

## db.json — Estrutura
```json
{
  "products": [{ "id": 1, "name": "Pão Francês", "cat": "Pães", "emoji": "🥖", "desc": "...", "price": 12.5, "unit": "unidade", "badge": "Novo", "image": "url", "available": true }],
  "categories": [{ "id": 1, "name": "Pães", "image": "🥖" }],
  "orders": [{ "id": 1001, "client": "Nome", "phone": "5511999999999", "type": "Entrega/Retirada", "address": "...", "items": [{ "name": "...", "qty": 2, "price": 12.5 }], "pay": "PIX/Cartão/Dinheiro", "total": 25, "obs": "...", "time": "14:30", "status": "pending" }],
  "storeSettings": { "name": "...", "cnpj": "...", "whatsapp": "...", "phone": "...", "address": "...", "description": "...", "adminPassword": "admin123", "deliveryFee": 5, "minOrder": 15, "freeDeliveryFrom": 40, "deliveryRadius": 5, "pixKey": "...", "pixName": "...", "pixBank": "..." },
  "horarios": [{ "day": "Segunda", "open": "06:00", "close": "19:00", "active": true }],
  "orderCounter": 1000
}
```

Ordem dos status: `pending → making → ready → delivered`

## Site Público (public/index.html)
- **Nav:** logo dinâmico (nome da loja do settings), badge Aberto/Fechado, carrinho
- **Hero:** badge + título + subtítulo tudo vindo do settings
- **Cardápio:** abas de categoria, grid de produtos, spinner de loading
- **Sobre:** seção de história com texto dinâmico
- **Carrinho:** slide panel da direita, qtd, total, finalizar
- **Checkout:** nome, telefone, endereço (se entrega), forma de pagamento, PIX info
- **Footer:** endereço, WhatsApp link, nome da loja
- **Admin float:** link flutuante pro admin (canto inferior direito)
- **Taxa de entrega:** exibida no checkout quando "Entrega" selecionado, calcula frete grátis

## Painel Admin (admin/index.html)
- **Login:** overlay com senha, token no sessionStorage
- **Sidebar:** responsiva com hamburger em mobile, navegação entre páginas
- **Dashboard:** KPIs (pedidos hoje, faturamento, em andamento, mais vendido), pedidos recentes
- **Pedidos:** tabela com filtro por status, auto-refresh a cada 10s, notificação sonora (3 tons)
- **Produtos:** grid de cards, toggle disponível, upload de foto, editar/deletar
- **Categorias:** lista editável
- **Dados da Loja:** formulário completo com gerais, segurança, PIX, entrega, horários
- **Relatórios:** produtos mais vendidos
- **WhatsApp:** botão no modal do pedido que abre wa.me com resumo

## Deploy Fly.io
- Porta: `8080` (setada via env `PORT`)
- Volume: `padaria_data` (1GB) montado em `/app/data`
- Região: `gru` (São Paulo)
- Dockerfile: `node:20-alpine`, `npm ci --omit=dev`
- `initDB()` garante que db.json existe mesmo em volume vazio
- Imagens vão pra `data/uploads/` (dentro do volume)

## Template Reutilizável
- Todo conteúdo textual é dinâmico via `storeSettings.name` e `storeSettings.description`
- Basta mudar `data/db.json` ou configurar pelo admin
- `fly.example.toml` tem configuração genérica do Fly.io
- `setup.ps1` instala dependências com um clique
- `README.md` tem manual completo em português

## Pedidos
- O número do pedido é gerado pelo servidor: `db.orderCounter` incrementado a cada POST
- Começa em 1000, primeiro pedido é #1001
- O cliente **não escolhe** o número
- O admin vê pedidos em tempo real (polling 10s)

## Fotos
- Upload via input file → multer salva em `data/uploads/`
- Servido estaticamente em `/uploads/`
- Preview no admin antes de salvar
- No Fly.io, as fotos ficam no volume persistente
- Placeholder: `picsum.photos/seed/{slug}/400/300`

## Observações Importantes
- `data/uploads/` está no `.gitignore` (só existe no volume do Fly.io)
- `fly.toml` está no `.gitignore` (cada deploy tem o seu)
- `uploads/` (raiz) é legacy, não usado mais
- O servidor NUNCA expõe a senha do admin nas respostas da API
- Token admin expira quando o servidor reinicia (Set é volátil)
- O `fix.ps1` foi deletado (era script de migração único)
