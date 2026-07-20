/* ============================================================
   API Route: POST /api/upload
   
   Pipeline completo de processamento de documentos:
   Validação → Hash → Parse → IA (classificação) → Storage → README
   
   Suporta upload múltiplo. Processa sequencialmente para evitar
   race conditions no README do cliente.
   
   LGPD: Nunca loga conteúdo de documentos — apenas metadados
   operacionais (nome do arquivo, categoria, timestamp).
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";
import { validateFile, validateClientName, getEffectiveMimeType } from "@/lib/validation";
import { parseDocument } from "@/lib/parser/documentParser";
import { classifyDocument } from "@/lib/ai/classifier";
import { saveFile, ensureClientStructure } from "@/lib/storage/fileManager";
import { appendToReadme } from "@/lib/storage/readmeManager";
import { calculateHash, isDuplicate, registerHash } from "@/lib/hash";
import type { FileProcessingResult, UploadResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const clientName = formData.get("clientName") as string;

    // Validar nome do cliente
    const clientValidation = validateClientName(clientName || "");
    if (!clientValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          errors: [clientValidation.error!],
        } satisfies UploadResponse,
        { status: 400 }
      );
    }

    // Coletar todos os arquivos do FormData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          errors: ["Nenhum arquivo enviado. Selecione pelo menos um arquivo."],
        } satisfies UploadResponse,
        { status: 400 }
      );
    }

    // Garante estrutura do cliente
    await ensureClientStructure(clientName.trim());

    // Processa cada arquivo sequencialmente (evita race conditions no README)
    const results: FileProcessingResult[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const result = await processFile(file, clientName.trim());
        results.push(result);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : `Erro desconhecido ao processar "${file.name}"`;
        errors.push(errorMsg);
        console.error(
          `[Upload] Erro ao processar arquivo "${file.name}":`,
          error instanceof Error ? error.message : error
        );
      }
    }

    const hasResults = results.length > 0;

    return NextResponse.json(
      {
        success: hasResults,
        results,
        errors,
      } satisfies UploadResponse,
      { status: hasResults ? 200 : 500 }
    );
  } catch (error) {
    console.error("[Upload] Erro inesperado:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        success: false,
        results: [],
        errors: [
          "Erro interno do servidor. Tente novamente ou entre em contato com o suporte.",
        ],
      } satisfies UploadResponse,
      { status: 500 }
    );
  }
}

/**
 * Processa um arquivo individual através do pipeline completo.
 */
async function processFile(
  file: File,
  clientName: string
): Promise<FileProcessingResult> {
  // 1. Validação
  const validation = validateFile(file);
  if (!validation.valid) {
    return {
      fileName: file.name,
      category: "Nao-Classificado",
      summary: "",
      savedTo: "",
      isDuplicate: false,
      error: validation.error,
    };
  }

  // 2. Ler buffer do arquivo
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Calcular hash e verificar duplicata
  const hash = calculateHash(buffer);
  const duplicate = await isDuplicate(clientName, hash);

  if (duplicate) {
    return {
      fileName: file.name,
      category: "Nao-Classificado",
      summary: "",
      savedTo: "",
      isDuplicate: true,
      error: `Arquivo "${file.name}" já foi enviado anteriormente para este cliente.`,
    };
  }

  // 4. Parse do documento (extrair texto ou preparar imagem)
  const mimeType = getEffectiveMimeType(file);
  const parsed = await parseDocument(buffer, mimeType, file.name);

  // 5. Classificação via IA
  const classification = await classifyDocument(parsed);

  // 6. Salvar arquivo na pasta correta
  const savedTo = await saveFile(
    clientName,
    classification.category,
    file.name,
    buffer
  );

  // 7. Registrar hash para detecção futura de duplicatas
  await registerHash(clientName, hash, file.name);

  // 8. Append no README do cliente
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  await appendToReadme(clientName, {
    date: dateStr,
    fileName: file.name,
    category: classification.category,
    summary: classification.summary,
  });

  // Log operacional (sem conteúdo sensível)
  console.log(
    `[Upload] Arquivo "${file.name}" → Cliente: "${clientName}" → Categoria: "${classification.category}" → Salvo em: "${savedTo}"`
  );

  return {
    fileName: file.name,
    category: classification.category,
    summary: classification.summary,
    savedTo,
    isDuplicate: false,
  };
}
