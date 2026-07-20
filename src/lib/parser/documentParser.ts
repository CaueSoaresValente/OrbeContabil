/* ============================================================
   Document Parser — Extração de conteúdo de documentos
   
   Estratégia por tipo de arquivo:
   - PDF digital: extrai texto via pdf-parse
   - PDF escaneado: se texto extraído < MIN_TEXT_LENGTH chars,
     converte APENAS A PRIMEIRA PÁGINA em imagem via pdf2pic e
     envia ao Gemini como input multimodal (OCR nativo do modelo)
   - Imagem (PNG/JPG/JPEG): retorna buffer para envio direto ao
     Gemini no modo multimodal
   - TXT: leitura direta do buffer como UTF-8
   
   DECISÃO DE DESIGN — Apenas primeira página para PDFs escaneados:
   A maioria dos documentos contábeis (contratos, comprovantes, notas
   fiscais) concentra a informação relevante para classificação na
   primeira página. Processar apenas ela mantém o custo por documento
   previsível (~$0.0003/doc) e a latência baixa.
   
   TODO FUTURO: Se a taxa de classificações incorretas em documentos
   escaneados for alta, considerar processar múltiplas páginas
   (ex.: primeiras 3) e concatenar as imagens ou enviar como array
   multimodal ao Gemini. Isso aumentaria o custo proporcionalmente.
   ============================================================ */

import type { ParsedDocument } from "@/types";
import { MIN_TEXT_LENGTH } from "@/types";

/**
 * Extrai o conteúdo de um documento a partir do seu buffer e tipo MIME.
 * 
 * @param buffer - Buffer do arquivo
 * @param mimeType - Tipo MIME do arquivo
 * @param fileName - Nome do arquivo (para logs e mensagens de erro)
 * @returns ParsedDocument - Texto extraído ou imagem para OCR
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParsedDocument> {
  const mime = mimeType.toLowerCase();

  if (mime === "application/pdf") {
    return parsePdf(buffer, fileName);
  }

  if (mime.startsWith("image/")) {
    return {
      type: "image",
      buffer,
      mimeType: mime,
    };
  }

  if (mime === "text/plain") {
    return {
      type: "text",
      content: buffer.toString("utf-8"),
    };
  }

  throw new Error(
    `Tipo de arquivo não suportado para parsing: ${mime} (${fileName})`
  );
}

/**
 * Extrai texto de um PDF. Se o texto extraído for muito curto
 * (indicando um PDF escaneado/imagem), converte a primeira página
 * em imagem para processamento multimodal via Gemini.
 */
async function parsePdf(
  buffer: Buffer,
  fileName: string
): Promise<ParsedDocument> {
  try {
    // Importação dinâmica — pdf-parse v2+ exporta PDFParse como named export
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const extractedText = textResult.text?.trim() || "";
    await parser.destroy();

    /*
     * FALLBACK PARA PDF ESCANEADO:
     * Se pdf-parse retorna menos de MIN_TEXT_LENGTH (50) caracteres,
     * o PDF provavelmente é um scan/foto sem camada de texto.
     * Nesse caso, convertemos a primeira página em imagem e enviamos
     * ao Gemini no modo multimodal, que faz OCR nativamente.
     */
    if (extractedText.length < MIN_TEXT_LENGTH) {
      console.log(
        `[Parser] PDF "${fileName}" retornou apenas ${extractedText.length} chars — tratando como escaneado, convertendo primeira página em imagem.`
      );
      return convertPdfPageToImage(buffer);
    }

    return {
      type: "text",
      content: extractedText,
    };
  } catch (error) {
    // Se pdf-parse falhar completamente, tenta conversão para imagem
    console.warn(
      `[Parser] Falha ao extrair texto do PDF "${fileName}": ${error instanceof Error ? error.message : error}. Tentando conversão para imagem.`
    );
    return convertPdfPageToImage(buffer);
  }
}

/**
 * Converte a primeira página de um PDF em imagem PNG.
 * Usa pdf2pic que depende de GraphicsMagick/ImageMagick instalado no SO.
 * 
 * NOTA: Apenas a primeira página é convertida. Ver comentário de design
 * no topo do arquivo para justificativa.
 */
async function convertPdfPageToImage(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const { fromBuffer } = await import("pdf2pic");

    const converter = fromBuffer(buffer, {
      density: 200, // DPI — bom equilíbrio entre qualidade e tamanho
      format: "png",
      width: 1600,
      height: 2200,
      saveFilename: "page",
      savePath: "", // Não salva em disco, usa o buffer retornado
    });

    // Converte apenas a primeira página (página 1)
    const result = await converter(1, { responseType: "buffer" });

    if (!result?.buffer) {
      throw new Error("pdf2pic não retornou buffer da conversão");
    }

    return {
      type: "image",
      buffer: Buffer.from(result.buffer),
      mimeType: "image/png",
    };
  } catch (error) {
    throw new Error(
      `Falha ao converter PDF escaneado em imagem. ` +
        `Verifique se GraphicsMagick ou ImageMagick está instalado no sistema. ` +
        `Erro: ${error instanceof Error ? error.message : error}`
    );
  }
}
