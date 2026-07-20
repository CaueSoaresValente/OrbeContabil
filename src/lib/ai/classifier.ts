/* ============================================================
   AI Classifier — Classificação de documentos via Gemini
   
   Usa Gemini 3.1 Flash-Lite para classificar documentos em uma
   das 5 categorias fixas e gerar um resumo de 1 linha.
   
   Inclui retry com backoff exponencial (até 3 tentativas) para
   lidar com falhas transientes de rede, timeout e rate limiting.
   ============================================================ */

import { GoogleGenAI } from "@google/genai";
import type { ClassificationResult, ParsedDocument } from "@/types";
import { VALID_CATEGORIES, type DocumentCategory } from "@/types";
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildTextClassificationPrompt,
  IMAGE_CLASSIFICATION_PROMPT,
} from "./prompts";

/** Configuração de retry */
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/** Inicializa o cliente Gemini (singleton lazy) */
let genaiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Variável de ambiente GEMINI_API_KEY não configurada. " +
          "Obtenha uma chave em https://aistudio.google.com/apikey"
      );
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

/**
 * Classifica um documento usando Gemini 3.1 Flash-Lite.
 * Suporta input de texto puro ou imagem (multimodal).
 * Inclui retry com backoff exponencial para falhas transientes.
 *
 * @param parsed - Documento já parseado (texto ou imagem)
 * @returns ClassificationResult com categoria e resumo
 */
export async function classifyDocument(
  parsed: ParsedDocument
): Promise<ClassificationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callGemini(parsed);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Não faz retry para erros de configuração
      if (lastError.message.includes("GEMINI_API_KEY")) {
        throw lastError;
      }

      // Log sem conteúdo sensível
      console.warn(
        `[Classifier] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${lastError.message}`
      );

      // Se não é a última tentativa, aguarda com backoff exponencial
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Classifier] Aguardando ${delay}ms antes de tentar novamente...`);
        await sleep(delay);
      }
    }
  }

  // Esgotou todas as tentativas
  throw new Error(
    `Serviço de IA temporariamente indisponível após ${MAX_RETRIES} tentativas. ` +
      `Tente novamente em alguns instantes. Erro: ${lastError?.message || "desconhecido"}`
  );
}

/**
 * Faz a chamada real ao Gemini.
 */
async function callGemini(
  parsed: ParsedDocument
): Promise<ClassificationResult> {
  const client = getClient();

  let response;

  if (parsed.type === "text") {
    response = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: buildTextClassificationPrompt(parsed.content),
      config: {
        systemInstruction: CLASSIFICATION_SYSTEM_PROMPT,
        temperature: 0.1, // Baixa temperatura para classificação determinística
        maxOutputTokens: 200,
      },
    });
  } else {
    // Input multimodal (imagem)
    const base64Image = parsed.buffer.toString("base64");

    response = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: base64Image,
              },
            },
            { text: IMAGE_CLASSIFICATION_PROMPT },
          ],
        },
      ],
      config: {
        systemInstruction: CLASSIFICATION_SYSTEM_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 200,
      },
    });
  }

  const rawText = response.text?.trim() || "";
  return parseClassificationResponse(rawText);
}

/**
 * Faz parsing seguro da resposta JSON do modelo.
 * Se o JSON for malformado ou a categoria inválida, retorna "Nao-Classificado".
 */
export function parseClassificationResponse(
  rawText: string
): ClassificationResult {
  try {
    let cleaned = rawText.trim();
    
    // Remove wrappers de markdown se presentes
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    
    // Tenta extrair a estrutura JSON mais externa caso o modelo inclua texto explicativo
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Validar que a categoria é uma das 5 válidas
    const category = parsed.category as string;
    if (!VALID_CATEGORIES.includes(category as DocumentCategory)) {
      console.warn(
        `[Classifier] Categoria inválida recebida: "${category}". Usando "Nao-Classificado".`
      );
      return {
        category: "Nao-Classificado",
        summary: parsed.summary || "Documento não classificado automaticamente.",
      };
    }

    return {
      category: category as DocumentCategory,
      summary:
        parsed.summary?.slice(0, 150) ||
        "Documento classificado sem resumo disponível.",
    };
  } catch {
    console.warn(
      `[Classifier] Falha ao parsear resposta do modelo. Raw: "${rawText.slice(0, 100)}". Usando fallback.`
    );
    return {
      category: "Nao-Classificado",
      summary: "Documento não pôde ser classificado automaticamente.",
    };
  }
}

/** Utilitário de sleep para backoff */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset do cliente — útil para testes.
 * @internal
 */
export function _resetClient(): void {
  genaiClient = null;
}
