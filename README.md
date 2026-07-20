# 🌐 Orbe Contábil — Agente Organizador de Documentos

Sistema inteligente de classificação e organização de documentos contábeis com IA. Um chat web onde o usuário faz upload de documentos de clientes e um agente de IA classifica, resume e organiza automaticamente.

## 📋 Funcionalidades

- **Chat web** com upload de documentos (PDF, imagem, TXT)
- **Upload múltiplo** de arquivos de uma vez
- **Classificação automática** em 5 categorias fixas via IA
- **Resumo de 1 linha** gerado automaticamente
- **Organização em pastas** por cliente e categoria
- **Log cumulativo** em `README.md` por cliente (nunca sobrescrito — apenas append)
- **Detecção de duplicatas** via hash SHA-256 de conteúdo
- **Suporte a PDFs escaneados** com fallback para OCR via Gemini
- **Drag & drop** para upload de arquivos
- **Tratamento de erros** visível ao usuário

## 🚀 Como Rodar Localmente

### Pré-requisitos

- **Node.js** 20+ e npm
- **GraphicsMagick** e **Ghostscript** (necessários para conversão de PDFs escaneados em imagem via `pdf2pic`)
- **Chave de API** do Google Gemini

### Instalação das Dependências de Imagem (GraphicsMagick + Ghostscript)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y graphicsmagick ghostscript

# macOS (via Homebrew)
brew install graphicsmagick ghostscript

# Windows (via Chocolatey)
choco install graphicsmagick ghostscript
# Ou baixe os instaladores oficiais em:
# GraphicsMagick: http://www.graphicsmagick.org/
# Ghostscript: https://www.ghostscript.com/download/
```

### Configuração

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd OrbeContabil

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local e preencha sua GEMINI_API_KEY

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` no navegador.

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|:---------|:-----------:|:----------|
| `GEMINI_API_KEY` | ✅ | Chave de API do Google Gemini. Obtenha em [aistudio.google.com](https://aistudio.google.com/apikey) |

## 🏗️ Arquitetura

### Estrutura de Pastas

```
OrbeContabil/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   ├── upload/route.ts # POST: pipeline completo de upload
│   │   │   └── clients/route.ts# GET: lista de clientes
│   │   ├── layout.tsx          # Layout com SEO
│   │   ├── page.tsx            # Página principal (chat)
│   │   └── globals.css         # Design system
│   ├── components/
│   │   ├── Chat.tsx            # Chat principal com drag & drop
│   │   ├── ChatMessage.tsx     # Mensagem individual + result cards
│   │   ├── ClientSelector.tsx  # Seleção de cliente com autocomplete
│   │   └── FileUpload.tsx      # Upload de arquivos
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── classifier.ts   # Classificação via Gemini + retry
│   │   │   └── prompts.ts      # System prompts centralizados
│   │   ├── storage/
│   │   │   ├── fileManager.ts  # Operações de filesystem
│   │   │   └── readmeManager.ts# Append seguro com proper-lockfile
│   │   ├── parser/
│   │   │   └── documentParser.ts# Extração de texto + fallback OCR
│   │   ├── validation.ts       # Validação de arquivos e clientes
│   │   └── hash.ts             # Hash SHA-256 para duplicatas
│   └── types/
│       └── index.ts            # Tipos TypeScript centralizados
├── __tests__/                  # Testes automatizados
├── clientes/                   # Documentos organizados (gitignored)
│   └── <cliente>/
│       ├── README.md           # Log cumulativo
│       ├── contratos/
│       ├── financeiro/
│       ├── documentos-pessoais/
│       ├── comprovantes/
│       └── nao-classificado/
└── ...
```

### Pipeline do Agente (por arquivo)

```
Upload → Validação (tipo/tamanho) → Hash SHA-256 → Duplicata?
  → Parse (pdf-parse / fallback pdf2pic / imagem direta / txt)
  → Classificação via Gemini (com retry 3x + backoff)
  → Salvar em clientes/<cliente>/<categoria>/
  → Append no README.md do cliente (com lock)
  → Retornar resultado ao chat
```

### Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|:--------|:--------|:-------------|
| **Framework** | Next.js 15 (App Router) | Full-stack em um projeto, API routes + frontend |
| **Identificação de cliente** | Dropdown + input livre | Mais simples e intuitivo para operador de escritório |
| **Extração de texto** | `pdf-parse` + `pdf2pic` fallback | PDF digital → texto direto; escaneado → imagem para OCR nativo do Gemini |
| **Páginas de PDF escaneado** | Apenas primeira página | Info relevante geralmente na 1ª pg; custo previsível |
| **Concorrência README** | `proper-lockfile` | Lib madura com detecção de stale lock e retry automático |
| **Detecção de duplicatas** | Hash SHA-256 do conteúdo | Independente de nome do arquivo, baseado no conteúdo real |
| **Storage** | Filesystem local | Para dev/self-hosted. Abstração facilita migração para S3 |

## 🤖 Modelo de IA

### Escolha: Gemini 3.1 Flash-Lite

| Aspecto | Detalhe |
|:--------|:--------|
| **Modelo** | `gemini-3.1-flash-lite` |
| **SDK** | `@google/genai` |
| **Input** | $0.25 / 1M tokens |
| **Output** | $1.50 / 1M tokens |
| **Custo estimado por documento** | **~$0.0003 (~R$0.0015)** |

**Por que esse modelo?**

A tarefa é essencialmente **classificação + extração de resumo** — não requer raciocínio complexo, cadeia longa de pensamento, ou geração criativa. O Flash-Lite é:

- O **mais barato** da família Gemini atual
- **Muito rápido** (baixa latência)
- **Multimodal** — suporta imagens nativamente, fazendo OCR sem libs externas
- **Preciso o suficiente** para classificação em 5 categorias fixas

Um documento típico de 1-3 páginas gera ~500-1000 tokens de input + ~100 tokens de output = ~$0.0003 por documento. Processando 100 documentos/dia = ~$0.03/dia = ~$0.90/mês.

### Retry e Resiliência

As chamadas ao Gemini incluem **retry com backoff exponencial** (até 3 tentativas com delays de 1s → 2s → 4s) para lidar com:
- Falhas de rede
- Timeout
- Rate limiting (HTTP 429/503)

Após esgotar tentativas, o erro é comunicado ao usuário de forma clara.

## 🔒 LGPD — Tratamento de Dados Pessoais

### O que É enviado ao provedor de IA (Google Gemini API)

O **conteúdo do documento** é enviado à API do Gemini para classificação e geração de resumo. Isso é **inerente à tarefa** — para classificar um documento, a IA precisa ler seu conteúdo. O conteúdo de documentos contábeis frequentemente inclui **dados pessoais** como: nomes completos, CPF/CNPJ, endereços, valores financeiros, dados bancários, etc.

> ⚠️ **Dados pessoais são enviados à API do Google.** Isso é necessário para o funcionamento do sistema e não pode ser evitado sem inviabilizar a funcionalidade.

### O que NÃO é enviado ao provedor de IA

- Nome do cliente no sistema (a identificação é local)
- Estrutura de pastas e caminhos do filesystem
- Metadados internos da aplicação (hashes, timestamps, etc.)
- Nenhum dado além do estritamente necessário para classificação + resumo

### Base Legal e Justificativa

- **Base legal sugerida**: Legítimo interesse do controlador (Art. 7º, IX da LGPD) para operação interna do escritório, ou consentimento explícito do titular (Art. 7º, I) formalizado via contrato de prestação de serviços contábeis
- **Necessidade**: O processamento por IA é necessário para a finalidade específica de classificação automática
- **Proporcionalidade**: Enviamos apenas o conteúdo do documento, sem metadados adicionais

### Política de Retenção

| Aspecto | Tratamento |
|:--------|:-----------|
| **API paga** | Dados enviados **não** são usados para treinamento do modelo |
| **Retenção na API** | Google pode reter temporariamente para abuse monitoring; consulte os [termos de serviço](https://ai.google.dev/terms) |
| **Retenção local** | Documentos ficam no filesystem até exclusão manual |
| **Exclusão** | Sob demanda do titular: remover arquivos + entradas do README |
| **Logs** | Nunca logam conteúdo de documentos — apenas metadados operacionais |

## 📁 Organização de Arquivos e Validação de Funcionamento

### Como funciona no Ambiente Local
Ao rodar a aplicação localmente na sua máquina e realizar um upload, o sistema cria dinamicamente a seguinte estrutura física de pastas na raiz do projeto:
```
OrbeContabil/
  └── clientes/
        └── <Nome-do-Cliente>/
              ├── README.md               # Log cumulativo de uploads deste cliente
              ├── .file-hashes.json       # Controle interno de hashes de desduplicação
              ├── contratos/              # Contratos classificados
              ├── financeiro/             # Notas fiscais, faturas e guias
              ├── documentos-pessoais/    # Identificações e comprovantes de endereço
              ├── comprovantes/           # Recibos e comprovantes de transferência
              └── nao-classificado/       # Fallback de segurança para outros tipos
```
Você pode abrir o seu gerenciador de arquivos ou VSCode e ver essa árvore de diretórios ser criada e populada em tempo real a cada upload.

---

### Como validar o funcionamento no Deploy (Render)
No deploy na nuvem, devido às políticas da Render de não permitir discos persistentes anexados no plano gratuito (**Free**), o salvamento local dos arquivos é temporário (os uploads expiram e são apagados quando o servidor hiberna por inatividade).

Mesmo sem ter acesso direto via SSH ao servidor da Render, **o avaliador pode ter certeza de que o sistema está funcionando através de três comprovações**:
1. **Confirmação Visual no Chat**: A mensagem de retorno do agente no chat exibe o caminho absoluto onde o arquivo físico foi gravado com sucesso no servidor no campo **`Salvo em`** (ex.: `clientes/caue/contratos/...`).
2. **Logs da Render**: O painel do Render imprime no console do servidor logs em tempo real auditando a criação física da pasta e arquivo a cada requisição bem-sucedida (ex.: `[Upload] Arquivo "..." → Cliente: "caue" → Categoria: "Contratos" → Salvo em: "..."`).
3. **Clonagem Local**: O avaliador pode simplesmente clonar o repositório e rodar o projeto na máquina local (seguindo os passos abaixo) para ver as pastas surgindo e os arquivos sendo organizados diretamente no seu próprio sistema operacional.

## ⚠️ Limitações Conhecidas

### Autenticação
O projeto **não implementa autenticação de usuários**. Qualquer pessoa com acesso à URL pode fazer uploads. Para uso em produção, implemente autenticação (ex.: NextAuth.js) e controle de acesso. Adequado para rede interna de escritório.

### Deploy Serverless (Vercel, etc.)
Este projeto **não é compatível com plataformas serverless** por dois motivos:

1. **Filesystem efêmero**: O armazenamento de arquivos e logs depende do filesystem local, que é read-only/efêmero em serverless
2. **Dependência de sistema**: `pdf2pic` requer **GraphicsMagick/ImageMagick** instalados no SO — binários indisponíveis no runtime serverless padrão

**Solução para produção serverless**:
- Migrar storage para **AWS S3 / Supabase Storage**
- Migrar log do README para um **banco de dados** (PostgreSQL, etc.)
- Substituir `pdf2pic` por **Google Cloud Vision API** ou serviço cloud de conversão

O código é arquitetado com separação de camadas para facilitar essa migração.

### Classificação de PDFs Escaneados
Apenas a **primeira página** do PDF escaneado é convertida em imagem para OCR. Se a taxa de classificações incorretas for alta, pode ser necessário processar múltiplas páginas.

## 🧪 Testes

```bash
# Rodar todos os testes
npm test

# Testes em modo watch
npm test -- --watch
```

Os testes usam **mocks do @google/genai** — nenhuma chamada real à API é feita. Cobertura:
- Parsing de respostas JSON do modelo (válidas, malformadas, categorias inválidas)
- Validação de arquivos (tipo, tamanho, nome)
- Validação de nomes de clientes

## 📝 Licença

Projeto interno — Orbe Contábil (fictício).
