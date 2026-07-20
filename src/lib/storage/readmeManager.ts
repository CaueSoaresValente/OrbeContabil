/* ============================================================
   README Manager — Append seguro no log do cliente
   
   Cada cliente tem um README.md com um log cumulativo de
   documentos processados. O append é protegido por lock via
   proper-lockfile para evitar race conditions em uploads
   simultâneos ao mesmo cliente.
   
   O histórico NUNCA é sobrescrito — cada novo upload é um append.
   ============================================================ */

import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import type { ReadmeLogEntry } from "@/types";
import { getClientDir, ensureClientStructure } from "./fileManager";

/** Cabeçalho padrão do README de cada cliente */
const README_HEADER = `# Documentos Organizados

> Log cumulativo de documentos processados pelo Agente Organizador da Orbe Contábil.
> Cada entrada é adicionada automaticamente a cada upload. O histórico nunca é sobrescrito.

| Data | Arquivo | Categoria | Resumo |
|:-----|:--------|:----------|:-------|
`;

/**
 * Adiciona uma entrada ao README.md do cliente.
 * Usa proper-lockfile para garantir operação atômica e evitar
 * corrupção por uploads simultâneos.
 * 
 * @param clientName - Nome do cliente
 * @param entry - Dados da entrada a adicionar
 */
export async function appendToReadme(
  clientName: string,
  entry: ReadmeLogEntry
): Promise<void> {
  // Garante que a estrutura do cliente existe
  await ensureClientStructure(clientName);

  const clientDir = getClientDir(clientName);
  const readmePath = path.join(clientDir, "README.md");

  // Garante que o README existe antes de tentar lock
  await ensureReadmeExists(readmePath);

  let release: (() => Promise<void>) | null = null;

  try {
    /*
     * Adquire lock via proper-lockfile:
     * - retries: 5 tentativas com backoff exponencial
     * - stale: 10s — se um lock ficou preso (processo morreu), é liberado
     * - O lock é um arquivo .lock criado ao lado do README.md
     */
    release = await lockfile.lock(readmePath, {
      retries: {
        retries: 5,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 3000,
      },
      stale: 10000,
    });

    // Lê conteúdo atual
    const currentContent = await fs.readFile(readmePath, "utf-8");

    // Formata a nova linha da tabela
    const newLine = formatLogLine(entry);

    // Append da nova entrada
    const updatedContent = currentContent + newLine;

    // Escreve o arquivo atualizado
    await fs.writeFile(readmePath, updatedContent, "utf-8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Lock file is already being held")
    ) {
      throw new Error(
        `O log do cliente "${clientName}" está sendo atualizado por outro processo. ` +
          `Tente novamente em alguns instantes.`
      );
    }
    throw error;
  } finally {
    // Garante liberação do lock mesmo em caso de erro
    if (release) {
      try {
        await release();
      } catch {
        // Lock já foi liberado ou arquivo foi removido — ignorar
      }
    }
  }
}

/**
 * Garante que o README.md existe com o cabeçalho padrão.
 */
async function ensureReadmeExists(readmePath: string): Promise<void> {
  try {
    await fs.access(readmePath);
  } catch {
    // Arquivo não existe, criar com cabeçalho
    await fs.writeFile(readmePath, README_HEADER, "utf-8");
  }
}

/**
 * Formata uma entrada de log como linha de tabela Markdown.
 */
function formatLogLine(entry: ReadmeLogEntry): string {
  // Escapa pipes no resumo para não quebrar a tabela
  const safeSummary = entry.summary.replace(/\|/g, "\\|");
  return `| ${entry.date} | ${entry.fileName} | ${entry.category} | ${safeSummary} |\n`;
}
