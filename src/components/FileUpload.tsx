/* ============================================================
   FileUpload — Componente de upload de arquivos
   
   Suporta drag & drop + file picker.
   Preview de arquivos selecionados com opção de remover.
   Suporte a múltiplos arquivos simultâneos.
   ============================================================ */

"use client";

import { useRef, useCallback } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/types";

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUpload({ files, onFilesChange, disabled }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      // Filtrar arquivos inválidos por tamanho para feedback imediato
      const validFiles = fileArray.filter((f) => f.size <= MAX_FILE_SIZE);
      onFilesChange([...files, ...validFiles]);
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      onFilesChange(updated);
    },
    [files, onFilesChange]
  );

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      // Reset input para permitir reselecionar o mesmo arquivo
      e.target.value = "";
    }
  };

  const acceptString = ACCEPTED_EXTENSIONS.join(",");

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        multiple
        onChange={handleInputChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {/* Botão de attach */}
      <button
        type="button"
        className={`btn-icon ${files.length > 0 ? "btn-icon--active" : ""}`}
        onClick={handleClick}
        disabled={disabled}
        title="Anexar arquivo(s)"
      >
        📎
      </button>

      {/* Preview de arquivos selecionados */}
      {files.length > 0 && (
        <div className="file-preview-area">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="file-preview-item">
              <span className="file-preview-item__icon">
                {getFileIcon(file.type)}
              </span>
              <span className="file-preview-item__name">{file.name}</span>
              <span className="file-preview-item__size">
                {formatSize(file.size)}
              </span>
              <button
                className="file-preview-item__remove"
                onClick={() => removeFile(index)}
                title="Remover arquivo"
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
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
