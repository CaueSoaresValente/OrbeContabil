/* ============================================================
   ChatMessage — Renderização de uma mensagem individual no chat
   
   Suporta mensagens de texto, resultados de classificação,
   alertas de duplicata, e erros.
   ============================================================ */

"use client";

import type { ChatMessage as ChatMessageType, FileProcessingResult } from "@/types";
import { CATEGORY_SLUG_MAP } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`message message--${message.role}`}>
      <div className="message__avatar">
        {isUser ? "👤" : "🤖"}
      </div>
      <div className="message__content">
        {/* Arquivos anexados (no caso de mensagem do usuário) */}
        {message.files && message.files.length > 0 && (
          <div className="message__files">
            {message.files.map((file, i) => (
              <span key={i} className="message__file-badge">
                📎 {file.name}
              </span>
            ))}
          </div>
        )}

        {/* Texto da mensagem */}
        {message.content && <p>{message.content}</p>}

        {/* Indicador de carregamento */}
        {message.isLoading && (
          <div className="typing-indicator">
            <div className="typing-indicator__dot" />
            <div className="typing-indicator__dot" />
            <div className="typing-indicator__dot" />
          </div>
        )}

        {/* Resultados de classificação */}
        {message.results &&
          message.results.map((result, i) => (
            <ResultCard key={i} result={result} />
          ))}
      </div>
    </div>
  );
}

/** Card de resultado de classificação de um documento */
function ResultCard({ result }: { result: FileProcessingResult }) {
  // Erro ou duplicata
  if (result.error) {
    if (result.isDuplicate) {
      return (
        <div className="duplicate-card">
          ⚠️ <strong>Duplicata detectada:</strong> {result.error}
        </div>
      );
    }
    return (
      <div className="error-card">
        ❌ <strong>Erro:</strong> {result.error}
      </div>
    );
  }

  // Resultado normal
  const categorySlug = CATEGORY_SLUG_MAP[result.category];

  return (
    <div className="result-card">
      <div className="result-card__row">
        <span className="result-card__label">📄 Arquivo:</span>
        <span className="result-card__value">{result.fileName}</span>
      </div>
      <div className="result-card__row">
        <span className="result-card__label">🏷️ Categoria:</span>
        <span className={`result-card__category category--${categorySlug}`}>
          {result.category}
        </span>
      </div>
      <div className="result-card__row">
        <span className="result-card__label">📝 Resumo:</span>
        <span className="result-card__value">{result.summary}</span>
      </div>
      <div className="result-card__row">
        <span className="result-card__label">💾 Salvo em:</span>
        <span className="result-card__value" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
          {result.savedTo}
        </span>
      </div>
    </div>
  );
}
