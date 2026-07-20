/* ============================================================
   Validação de arquivos de upload
   Valida tipo MIME, extensão e tamanho antes do processamento.
   ============================================================ */

import {
  ACCEPTED_MIME_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
} from "@/types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida um arquivo antes do processamento.
 * Retorna um objeto indicando se o arquivo é válido ou a mensagem de erro.
 */
export function validateFile(
  file: File | { name: string; size: number; type: string }
): ValidationResult {
  // Validar tipo MIME
  const mimeType = file.type.toLowerCase();
  if (
    !ACCEPTED_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_MIME_TYPES)[number])
  ) {
    const extension = getExtension(file.name);
    // Fallback: aceitar por extensão se MIME não bater (comum em uploads)
    if (
      !ACCEPTED_EXTENSIONS.includes(
        extension as (typeof ACCEPTED_EXTENSIONS)[number]
      )
    ) {
      return {
        valid: false,
        error: `Formato não suportado: "${file.name}". Formatos aceitos: PDF, PNG, JPG, JPEG, TXT.`,
      };
    }
  }

  // Validar tamanho
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Arquivo "${file.name}" muito grande (${sizeMB}MB). Limite: 10MB.`,
    };
  }

  // Validar se não está vazio
  if (file.size === 0) {
    return {
      valid: false,
      error: `Arquivo "${file.name}" está vazio.`,
    };
  }

  return { valid: true };
}

/**
 * Valida o nome do cliente.
 */
export function validateClientName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      valid: false,
      error: "Nome do cliente é obrigatório. Selecione ou digite um nome.",
    };
  }

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: "Nome do cliente deve ter pelo menos 2 caracteres.",
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: "Nome do cliente não pode ter mais de 100 caracteres.",
    };
  }

  // Caracteres perigosos para filesystem
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(trimmed)) {
    return {
      valid: false,
      error:
        'Nome do cliente contém caracteres inválidos. Evite: < > : " / \\ | ? *',
    };
  }

  return { valid: true };
}

/** Extrai a extensão de um nome de arquivo */
function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Determina o tipo MIME efetivo de um arquivo.
 * Usa extensão como fallback se o tipo MIME reportado é genérico.
 */
export function getEffectiveMimeType(file: {
  name: string;
  type: string;
}): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }

  const ext = getExtension(file.name);
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
  };

  return mimeMap[ext] || "application/octet-stream";
}
