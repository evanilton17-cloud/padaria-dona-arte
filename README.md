# 🥖 Sistema de Cardápio Online para Padaria

Sistema completo de gestão de pedidos para padarias e confeitarias. Cardápio online com carrinho, painel administrativo com dashboard, gestão de produtos/pedidos/entregas, PIX integrado e deploy na nuvem.

## Funcionalidades

### Para o Cliente (Público)
- **Cardápio digital** com fotos, categorias e busca visual
- **Carrinho de compras** com quantidade e total em tempo real
- **Checkout** com opções: Entrega (com taxa) ou Retirada
- **Pagamento**: PIX (chave copiável), Cartão, Dinheiro
- **WhatsApp** link direto para pedir pelo celular
- **Aberto/Fechado automático** baseado nos horários configurados
- Design responsivo (funciona em celular e desktop)

### Para o Admin (Painel)
- **Dashboard** com pedidos hoje, faturamento, itens em andamento, mais vendido
- **Pedidos**: acompanhar em tempo real com som de notificação
- **Status**: Aguardando → Preparando → Pronto → Entregue
- **Produtos**: cadastro com foto (upload), categoria, preço, disponibilidade
- **Categorias**: organizar o cardápio
- **Horários**: configurar dias e horários de funcionamento
- **Configurações**: dados da loja, PIX, taxas de entrega, senha do admin
- **Relatórios**: produtos mais vendidos
- **Sidebar responsiva** com menu hamburger no celular

## Tecnologias

| Tecnologia | Versão |
|---|---|
| Node.js | 20+ |
| Express | 4.x |
| Multer | Para upload de fotos |
| JSON | Banco de dados (arquivo) |
| HTML/CSS/JS | Frontend puro (sem frameworks) |
| Fly.io | Hospedagem na nuvem |

---

## 🚀 Como usar

### 1. Requisitos

- [Node.js](https://nodejs.org/) versão 20 ou superior
- [Git](https://git-scm.com/) (opcional)

### 2. Rodar localmente

```bash
# Instalar dependências
npm install

# Iniciar o servidor
npm start
```

Acesse:
- **Site público:** http://localhost:3000
- **Painel admin:** http://localhost:3000/admin
- **API:** http://localhost:3000/api

**Login admin:** senha `admin123`

### 3. Personalizar

Edite as configurações no próprio painel admin:
1. Acesse `/admin` e faça login
2. Vá em **Dados da Loja**
3. Altere: nome, WhatsApp, endereço, PIX, taxas, horários

Para alterar as fotos dos produtos, acesse **Produtos** e clique em "Escolher foto" no produto desejado.

---

## ☁️ Deploy no Fly.io (produção)

### Criar conta no Fly.io

1. Acesse [fly.io](https://fly.io) e crie uma conta
2. Instale o Fly CLI seguindo [estas instruções](https://fly.io/docs/hands-on/install-flyctl/)
3. Faça login:

```bash
fly auth login
```

### Configurar e fazer deploy

```bash
# Iniciar o app (primeira vez)
fly launch

# O fly launch vai perguntar:
# - Nome do app: escolha um nome único (ex: padaria-minha)
# - Região: escolha a mais próxima dos seus clientes
#   São Paulo (gru) é a melhor opção para o Brasil
# - Criar volume? Responda SIM
# - Seu app está pronto para deploy? Responda NÃO por enquanto
```

### Ajustar configurações

Edite o arquivo `fly.toml` gerado. Exemplo completo:

```toml
app = 'padaria-minha'
primary_region = 'gru'

[build]

[env]
  PORT = '8080'

[[mounts]]
  source = 'padaria_data'
  destination = '/app/data'

[http_service]
  internal_port = 8080
  force_https = true

[[vm]]
  memory = '1gb'
  cpus = 1
  memory_mb = 1024
```

### Fazer deploy

```bash
fly deploy
```

### Acessar

Seu site estará online em `https://padaria-minha.fly.dev`

Para ver os logs:

```bash
fly logs
```

### Gerenciar dados

Os dados (produtos, pedidos, fotos) ficam em um **volume persistente** que não é perdido ao refazer deploy.

Para fazer backup manual:

```bash
fly ssh console -C "cat /app/data/db.json" > backup.json
```

---

## 📂 Estrutura do Projeto

```
├── server.js          # Servidor Express principal
├── package.json       # Dependências
├── Dockerfile         # Configuração do container
├── fly.toml           # Configuração do Fly.io
├── public/
│   └── index.html     # Site público (cardápio + checkout)
├── admin/
│   └── index.html     # Painel administrativo
├── data/
│   ├── db.json        # Banco de dados (produtos, pedidos, configs)
│   └── uploads/       # Fotos enviadas
├── uploads/           # Redirecionamento (cópia local)
├── .dockerignore
└── .gitignore
```

---

## 🔧 Configurações importantes

### Senha do admin

- Padrão: `admin123`
- Pode ser alterada em **Dados da Loja > Segurança**
- Mantida no arquivo `data/db.json` em `storeSettings.adminPassword`

### PIX

Configure em **Dados da Loja > PIX**:
- **Chave PIX** (CPF, CNPJ, email, telefone ou aleatória)
- **Titular** da conta
- **Banco/instituição**

O cliente vê essas informações no checkout ao selecionar PIX.

### Taxa de entrega

Configure em **Dados da Loja > Configurações de entrega**:
- **Taxa de entrega** valor fixo (R$)
- **Pedido mínimo** valor mínimo para aceitar pedidos
- **Entrega grátis** acima de quanto
- **Raio de entrega** em km (informativo)

### Horários

Configure em **Dados da Loja > Horários**:
- Defina horário de abertura e fechamento para cada dia
- Desative dias que não funcionam
- O site público mostra "Aberto" ou "Fechado" automaticamente

---

## 📱 Admin pelo celular

O painel admin é totalmente responsivo. Em telas menores que 768px:
- A sidebar vira um menu hamburger (☰)
- Toque no ícone para abrir/fechar o menu
- Conteúdo ocupa a tela toda

---

## 🔔 Notificações

O painel admin verifica novos pedidos a cada **10 segundos** automaticamente. Quando um novo pedido chega:
- Toca um som de notificação (3 tons)
- Aparece um toast "🔔 Novo pedido recebido!"
- O painel atualiza sozinho

---

## 🤝 Suporte

Para dúvidas sobre o código, entre em contato pelo WhatsApp.

---

## 📄 Licença

Este projeto é de propriedade do comprador. Distribuição não autorizada é proibida.

---

> Feito com ❤️ para sua padaria
