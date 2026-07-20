/* ============================================================
   Tipos centralizados — Agente Organizador de Documentos
   ============================================================ */

/** As 5 categorias fixas de documentos. Nunca invente novas. */
export type DocumentCategory =
  | "Contratos"
  | "Financeiro"
  | "Documentos Pessoais"
  | "Comprovantes"
  | "Nao-Classificado";

/** Slug da categoria para uso em diretórios/CSS */
export type CategorySlug =
  | "contratos"
  | "financeiro"
  | "documentos-pessoais"
  | "comprovantes"
  | "nao-classificado";

/** Mapa categoria → slug de diretório */
export const CATEGORY_SLUG_MAP: Record<DocumentCategory, CategorySlug> = {
  Contratos: "contratos",
  Financeiro: "financeiro",
  "Documentos Pessoais": "documentos-pessoais",
  Comprovantes: "comprovantes",
  "Nao-Classificado": "nao-classificado",
};

/** Lista de categorias válidas para validação */
export const VALID_CATEGORIES: DocumentCategory[] = [
  "Contratos",
  "Financeiro",
  "Documentos Pessoais",
  "Comprovantes",
  "Nao-Classificado",
];

/** Resultado da classificação retornado pela IA */
export interface ClassificationResult {
  category: DocumentCategory;
  summary: string;
}

/** Resultado do parsing do documento */
export type ParsedDocument =
  | { type: "text"; content: string }
  | { type: "image"; buffer: Buffer; mimeType: string };

/** Resultado do processamento de um arquivo individual */
export interface FileProcessingResult {
  fileName: string;
  category: DocumentCategory;
  summary: string;
  savedTo: string;
  isDuplicate: boolean;
  error?: string;
}

/** Resposta da API de upload */
export interface UploadResponse {
  success: boolean;
  results: FileProcessingResult[];
  errors: string[];
}

/** Mensagem no chat */
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  files?: ChatFile[];
  results?: FileProcessingResult[];
  isLoading?: boolean;
}

/** Arquivo no chat */
export interface ChatFile {
  name: string;
  size: number;
  type: string;
}

/** Entrada no README log do cliente */
export interface ReadmeLogEntry {
  date: string;
  fileName: string;
  category: DocumentCategory;
  summary: string;
}

/** Tipos MIME aceitos */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
] as const;

/** Extensões aceitas */
export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
] as const;

/** Tamanho máximo de arquivo: 10MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Limiar mínimo de texto extraído de um PDF (em caracteres).
 * Se pdf-parse retornar menos caracteres que isso, o PDF é tratado
 * como escaneado e convertido em imagem para OCR via Gemini.
 */
export const MIN_TEXT_LENGTH = 50;
