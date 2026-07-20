# Walkthrough — Agente Organizador de Documentos

Documentação de encerramento demonstrando o que foi implementado, os testes realizados e como rodar o sistema localmente.

## O Que Foi Implementado

Implementamos o pipeline completo para a **Orbe Contábil**, cobrindo o setup com Next.js 16 (Turbopack) e TypeScript:

1. **Tipagem e Validações (`/src/types/index.ts` e `/src/lib/validation.ts`)**:
   - Definição exata das 5 categorias e limites de arquivos (10MB).
   - Validador robusto de nome do cliente (prevenindo XSS e manipulações de filesystem).
   - Validador de formato de arquivo (PDF, PNG, JPG, JPEG, TXT).

2. **Parser e Extração (`/src/lib/parser/documentParser.ts`)**:
   - Parsing digital via `pdf-parse` v1.1.1.
   - Fallback de PDF escaneado (menos de 50 caracteres): converte a **primeira página apenas** para imagem PNG via `pdf2pic` e envia para processamento multimodal via Gemini.

3. **Camada de IA (`/src/lib/ai/classifier.ts` e `/src/lib/ai/prompts.ts`)**:
   - Integração com o SDK moderno do Google Gemini (`@google/genai`) usando `gemini-3.1-flash-lite`.
   - Sistema de retry resiliente (3 tentativas com **backoff exponencial**).
   - Parser seguro para a resposta JSON do modelo usando regex para extração de JSON isolado, garantindo robustez a preâmbulos ou pós-textos da IA.

4. **Armazenamento e Concorrência (`/src/lib/storage/`)**:
   - `fileManager.ts`: Cria diretórios estruturados para o cliente e gerencia nomes duplicados adicionando sufixos numéricos.
   - `readmeManager.ts`: Append thread-safe no arquivo `README.md` protegido por `proper-lockfile` (com detecção de locks stale e retries com backoff).

5. **Detecção de Duplicatas (`/src/lib/hash.ts`)**:
   - Cálculo de hash SHA-256 do conteúdo para detectar uploads duplicados por cliente antes de chamar a IA, economizando custos e tempo.

6. **Frontend e API Routes (`/src/app/`)**:
   - `/api/upload` e `/api/clients` orquestrando o backend de forma sequencial por arquivo para evitar concorrências desnecessárias.
   - Interface de Chat premium em HTML/CSS nativo, com seleção de clientes inteligente (atualização no focus), drag & drop e controle de anexos fluido.

## Testes Realizados e Validação

- Criamos 27 testes unitários cobrindo:
  - Todas as ramificações de parsing de JSON de classificação de IA.
  - Comportamento de falhas, respostas malformadas, wrappers de markdown.
  - Validação de extensões, tipos MIME complexos, limites de tamanho e higienização de strings de cliente.
- Todos os testes utilizam **mocks da API do Gemini** (`jest.mock`), garantindo execução offline e sem consumo de créditos.
- **Resultado dos testes**: 100% de sucesso (27 testes passando).
- **Compilação**: Projeto compila perfeitamente sem warnings no pipeline do Next.js.

## Como os Arquivos São Organizados em Disco

Quando um documento é carregado, ele é armazenado localmente na seguinte estrutura:

```
clientes/
  └── <nome-do-cliente>/
        ├── README.md                  # Log histórico tabular cumulativo
        ├── .file-hashes.json          # Histórico de hashes SHA-256 para desduplicação
        ├── contratos/                 # Contratos e aditivos
        ├── financeiro/                # Notas fiscais, DARFs, extratos
        ├── documentos-pessoais/       # RG, CPF, comprovantes de residência
        ├── comprovantes/              # Comprovantes de pagamentos/recibos
        └── nao-classificado/          # Fallback quando não há classificação clara
```
