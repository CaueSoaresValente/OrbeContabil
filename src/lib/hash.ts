/* ============================================================
   Content Hash — Detecção de duplicatas via SHA-256
   
   Calcula um hash do conteúdo do arquivo para detectar quando
   o mesmo documento é enviado duas vezes para o mesmo cliente.
   ============================================================ */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getClientDir } from "./storage/fileManager";

/** Nome do arquivo que armazena hashes conhecidos por cliente */
const HASH_FILE = ".file-hashes.json";

/**
 * Calcula o hash SHA-256 de um buffer.
 */
export function calculateHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Verifica se um arquivo com o mesmo hash já existe para este cliente.
 * Retorna true se é duplicata.
 * 
 * @param clientName - Nome do cliente
 * @param hash - Hash SHA-256 do conteúdo
 */
export async function isDuplicate(
  clientName: string,
  hash: string
): Promise<boolean> {
  const hashes = await loadHashes(clientName);
  return hashes.includes(hash);
}

/**
 * Registra o hash de um arquivo processado.
 * 
 * @param clientName - Nome do cliente
 * @param hash - Hash SHA-256 do conteúdo
 * @param fileName - Nome do arquivo (para referência)
 */
export async function registerHash(
  clientName: string,
  hash: string,
  fileName: string
): Promise<void> {
  const clientDir = getClientDir(clientName);
  const hashFilePath = path.join(clientDir, HASH_FILE);

  let hashData: Record<string, string> = {};

  try {
    const content = await fs.readFile(hashFilePath, "utf-8");
    hashData = JSON.parse(content);
  } catch {
    // Arquivo não existe ainda
  }

  hashData[hash] = fileName;
  await fs.writeFile(hashFilePath, JSON.stringify(hashData, null, 2), "utf-8");
}

/**
 * Carrega os hashes conhecidos de um cliente.
 */
async function loadHashes(clientName: string): Promise<string[]> {
  const clientDir = getClientDir(clientName);
  const hashFilePath = path.join(clientDir, HASH_FILE);

  try {
    const content = await fs.readFile(hashFilePath, "utf-8");
    const hashData = JSON.parse(content);
    return Object.keys(hashData);
  } catch {
    return [];
  }
}
