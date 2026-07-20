/* ============================================================
   ClientSelector — Componente de seleção de cliente
   
   Combo box com autocomplete: lista clientes existentes da API
   e permite criar um novo digitando o nome.
   ============================================================ */

"use client";

import { useState, useEffect, useRef } from "react";

interface ClientSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientSelector({
  value,
  onChange,
  disabled,
}: ClientSelectorProps) {
  const [clients, setClients] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredClients, setFilteredClients] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Buscar clientes existentes da API
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        setClients(data.clients || []);
      } catch {
        // Silenciosamente falha — o campo continua funcional
      }
    }
    fetchClients();
  }, []);

  // Filtrar clientes baseado no input
  useEffect(() => {
    if (!value.trim()) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [value, clients]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="client-selector">
      <label className="client-selector__label" htmlFor="client-input">
        👤 Cliente:
      </label>
      <div className="client-selector__wrapper" ref={wrapperRef}>
        <input
          id="client-input"
          type="text"
          className="client-selector__input"
          placeholder="Selecione ou digite o nome do cliente..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
        {isOpen && filteredClients.length > 0 && (
          <div className="client-selector__dropdown">
            {filteredClients.map((client) => (
              <div
                key={client}
                className="client-selector__option"
                onClick={() => {
                  onChange(client);
                  setIsOpen(false);
                }}
              >
                {client}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
