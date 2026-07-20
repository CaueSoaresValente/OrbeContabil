/* ============================================================
   Chat — Componente principal do chat web
   
   Interface completa com:
   - Header com branding
   - Área de mensagens com scroll automático
   - Seleção de cliente (dropdown + input)
   - Upload de arquivos com drag & drop
   - Input de mensagem
   - Envio e exibição de resultados
   ============================================================ */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ClientSelector } from "./ClientSelector";
import { ChatMessage } from "./ChatMessage";
import type {
  ChatMessage as ChatMessageType,
  UploadResponse,
  ChatFile,
} from "@/types";
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/types";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [clientName, setClientName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Só fecha se saiu do container principal
    if (
      e.currentTarget === e.target ||
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.size <= MAX_FILE_SIZE && f.size > 0
      );
      if (droppedFiles.length > 0) {
        setFiles((prev) => [...prev, ...droppedFiles]);
      }
    }
  }, []);

  // Adicionar arquivos via file picker
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files).filter(
          (f) => f.size <= MAX_FILE_SIZE && f.size > 0
        );
        setFiles((prev) => [...prev, ...newFiles]);
        e.target.value = ""; // Reset para permitir reselecionar
      }
    },
    []
  );

  // Remover arquivo do preview
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Enviar arquivos para processamento
  const handleSubmit = useCallback(async () => {
    if (files.length === 0 || isLoading) return;

    if (!clientName.trim()) {
      addAgentMessage(
        "⚠️ Por favor, selecione ou digite o nome do cliente antes de enviar os documentos."
      );
      return;
    }

    // Mensagem do usuário
    const userMsg: ChatMessageType = {
      id: generateId(),
      role: "user",
      content: `Enviando ${files.length} arquivo(s) para o cliente "${clientName.trim()}"`,
      timestamp: new Date(),
      files: files.map(
        (f): ChatFile => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })
      ),
    };

    // Mensagem de loading do agente
    const loadingId = generateId();
    const loadingMsg: ChatMessageType = {
      id: loadingId,
      role: "agent",
      content: "Analisando e classificando documentos...",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      // Preparar FormData
      const formData = new FormData();
      formData.append("clientName", clientName.trim());
      for (const file of files) {
        formData.append("files", file);
      }

      // Enviar para API
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let data: UploadResponse;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Resposta inválida do servidor (Status HTTP: ${response.status} - ${response.statusText || "Erro Interno"}).`
        );
      }

      // Remover mensagem de loading e adicionar resultado
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.id !== loadingId);

        const successCount = data.results.filter((r) => !r.error).length;
        const totalCount = data.results.length + data.errors.length;

        const resultMsg: ChatMessageType = {
          id: generateId(),
          role: "agent",
          content: data.success
            ? `✅ Processamento concluído! ${successCount} de ${totalCount} arquivo(s) classificado(s) com sucesso.`
            : "❌ Ocorreram erros durante o processamento.",
          timestamp: new Date(),
          results: data.results,
        };

        // Erros globais como mensagens separadas
        const errorMsgs: ChatMessageType[] = data.errors.map(
          (err): ChatMessageType => ({
            id: generateId(),
            role: "agent",
            content: `❌ ${err}`,
            timestamp: new Date(),
          })
        );

        return [...withoutLoading, resultMsg, ...errorMsgs];
      });
    } catch (error) {
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.id !== loadingId);
        return [
          ...withoutLoading,
          {
            id: generateId(),
            role: "agent" as const,
            content: `❌ Erro de conexão: ${error instanceof Error ? error.message : "Não foi possível conectar ao servidor. Verifique sua conexão."}`,
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
      setFiles([]);
    }
  }, [files, clientName, isLoading]);

  // Helper para adicionar mensagem do agente
  const addAgentMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "agent" as const,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Handle Enter para enviar
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const acceptString = ACCEPTED_EXTENSIONS.join(",");

  return (
    <div
      className="chat-wrapper"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        multiple
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        disabled={isLoading}
      />

      {/* Header */}
      <header className="chat-header">
        <div className="chat-header__logo">O</div>
        <div className="chat-header__info">
          <h1>Orbe Contábil</h1>
          <p>Agente Organizador de Documentos</p>
        </div>
      </header>

      {/* Mensagens */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="welcome-message__icon">📂</div>
            <h2 className="welcome-message__title">
              Bem-vindo ao Organizador de Documentos
            </h2>
            <p className="welcome-message__hint">
              Selecione um cliente, anexe documentos (PDF, imagem ou TXT) e
              envie. O agente classificará automaticamente cada documento em uma
              das categorias e organizará os arquivos nas pastas corretas.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Área de Input */}
      <div className="chat-input-area">
        <ClientSelector
          value={clientName}
          onChange={setClientName}
          disabled={isLoading}
        />

        <div className="chat-input-row">
          <div className="chat-input-row__message">
            {/* Preview de arquivos selecionados */}
            {files.length > 0 && (
              <div className="file-preview-area">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="file-preview-item"
                  >
                    <span className="file-preview-item__icon">
                      {getFileIcon(file.type)}
                    </span>
                    <span className="file-preview-item__name">
                      {file.name}
                    </span>
                    <span className="file-preview-item__size">
                      {formatSize(file.size)}
                    </span>
                    <button
                      className="file-preview-item__remove"
                      onClick={() => removeFile(index)}
                      title="Remover arquivo"
                      disabled={isLoading}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              className="chat-textarea"
              placeholder={
                files.length > 0
                  ? "Pressione Enter para enviar os arquivos..."
                  : "Anexe documentos para classificar..."
              }
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              readOnly
            />

            {/* Action buttons */}
            <div className="chat-actions">
              <button
                type="button"
                className={`btn-icon ${files.length > 0 ? "btn-icon--active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Anexar arquivo(s)"
              >
                📎
              </button>
            </div>
          </div>

          <button
            className="btn-send"
            onClick={handleSubmit}
            disabled={files.length === 0 || isLoading}
            title="Enviar documentos"
          >
            {isLoading ? "⏳" : "➤"}
          </button>
        </div>
      </div>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-overlay__content">
            <div className="drag-overlay__icon">📄</div>
            <div className="drag-overlay__text">
              Solte os arquivos aqui para anexar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Gerador simples de IDs únicos */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Ícone baseado no tipo do arquivo */
function getFileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "text/plain") return "📝";
  return "📁";
}

/** Formata tamanho em bytes para KB/MB legível */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
