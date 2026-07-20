/* ============================================================
   API Route: GET /api/clients
   
   Retorna a lista de clientes existentes (nomes dos diretórios
   em clientes/).
   ============================================================ */

import { NextResponse } from "next/server";
import { listClients } from "@/lib/storage/fileManager";

export async function GET(): Promise<NextResponse> {
  try {
    const clients = await listClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error(
      "[Clients] Erro ao listar clientes:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { clients: [], error: "Erro ao listar clientes." },
      { status: 500 }
    );
  }
}
