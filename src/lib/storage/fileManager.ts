/* ============================================================
   File Manager — Operações de filesystem para documentos
   
   Responsável por salvar arquivos, criar estrutura de pastas,
   e listar clientes existentes.
   
   NOTA: Implementação local (filesystem). Em produção serverless,
   substituir por S3/Supabase Storage via interface equivalente.
   ============================================================ */

import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_SLUG_MAP, type DocumentCategory, type CategorySlug } from "@/types";

/** Diretório base para armazenamento de documentos de clientes */
const CLIENTS_BASE_DIR = path.join(process.cwd(), "clientes");

/** Subpastas de categorias que todo cliente tem */
const CATEGORY_DIRS: CategorySlug[] = [
  "contratos",
  "financeiro",
  "documentos-pessoais",
  "comprovantes",
  "nao-classificado",
];

/**
 * Sanitiza um nome para uso seguro no filesystem.
 * Remove caracteres perigosos e normaliza espaços.
 */
export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Garante que a estrutura de pastas do cliente existe.
 * Cria o diretório do cliente e as subpastas de categorias.
 */
export async function ensureClientStructure(
  clientName: string
): Promise<string> {
  const safeName = sanitizeName(clientName);
  const clientDir = path.join(CLIENTS_BASE_DIR, safeName);

  // Cria diretório do cliente e todas as subpastas de categorias
  for (const categoryDir of CATEGORY_DIRS) {
    await fs.mkdir(path.join(clientDir, categoryDir), { recursive: true });
  }

  return clientDir;
}

/**
 * Salva um arquivo na pasta correta do cliente.
 * Se já existir um arquivo com o mesmo nome, adiciona sufixo numérico.
 * 
 * @returns Caminho relativo onde o arquivo foi salvo
 */
export async function saveFile(
  clientName: string,
  category: DocumentCategory,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const safeName = sanitizeName(clientName);
  const categorySlug = CATEGORY_SLUG_MAP[category];
  const clientDir = path.join(CLIENTS_BASE_DIR, safeName);

  // Garante que a estrutura existe
  await fs.mkdir(path.join(clientDir, categorySlug), { recursive: true });

  // Gera nome de arquivo seguro e único
  const safeFileName = sanitizeFileName(fileName);
  const finalPath = await getUniqueFilePath(
    path.join(clientDir, categorySlug),
    safeFileName
  );

  await fs.writeFile(finalPath, buffer);

  // Retorna caminho relativo para exibição
  const relativePath = path.relative(process.cwd(), finalPath);
  return relativePath.replace(/\\/g, "/");
}

/**
 * Lista todos os clientes existentes (nomes de diretórios em clientes/).
 */
export async function listClients(): Promise<string[]> {
  try {
    await fs.mkdir(CLIENTS_BASE_DIR, { recursive: true });
    const entries = await fs.readdir(CLIENTS_BASE_DIR, {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/**
 * Retorna o diretório base de um cliente.
 */
export function getClientDir(clientName: string): string {
  return path.join(CLIENTS_BASE_DIR, sanitizeName(clientName));
}

/**
 * Sanitiza nome de arquivo, preservando a extensão.
 */
function sanitizeFileName(fileName: string): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const safeBase = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .trim();
  return `${safeBase || "documento"}${ext}`;
}

/**
 * Se um arquivo com o mesmo nome já existe, adiciona sufixo numérico.
 * Ex.: contrato.pdf → contrato_2.pdf → contrato_3.pdf
 */
async function getUniqueFilePath(
  dir: string,
  fileName: string
): Promise<string> {
  let filePath = path.join(dir, fileName);

  try {
    await fs.access(filePath);
  } catch {
    // Arquivo não existe, pode usar o nome original
    return filePath;
  }

  // Arquivo existe, adicionar sufixo
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let counter = 2;

  while (true) {
    filePath = path.join(dir, `${base}_${counter}${ext}`);
    try {
      await fs.access(filePath);
      counter++;
    } catch {
      return filePath;
    }
  }
}
