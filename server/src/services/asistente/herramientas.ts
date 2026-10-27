// Herramientas del asistente del equipo = las del conector MCP, sin salir del
// proceso.
//
// Se arma el mismo servidor MCP que usa el conector de Claude (`buildMcpServer`)
// y se le habla por un transporte en memoria. Así el chat de Voltia PM y el
// conector comparten herramientas, descripciones y chequeos de permisos: una
// herramienta nueva del conector aparece sola en el chat.
//
// Por ahora el chat solo usa las de lectura (`readOnlyHint`): no crea leads,
// no mueve etapas ni publica propuestas.

import type Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { McpUser } from "../../routes/mcp/context.js";
import { buildMcpServer } from "../../routes/mcp/server.js";

/** Tope de texto de un resultado: una herramienta que devuelve de más no puede llenar el contexto. */
const MAX_RESULTADO = 60_000;

export type Herramientas = {
  definiciones: Anthropic.Tool[];
  llamar: (nombre: string, args: unknown) => Promise<{ texto: string; error: boolean }>;
  cerrar: () => Promise<void>;
};

export async function abrirHerramientas(user: McpUser): Promise<Herramientas> {
  const server = buildMcpServer(user);
  const [lado1, lado2] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "voltia-pm-asistente", version: "1.0.0" });
  await Promise.all([server.connect(lado1), client.connect(lado2)]);

  const { tools } = await client.listTools();
  const lectura = tools.filter((t) => t.annotations?.readOnlyHint === true);
  const nombres = new Set(lectura.map((t) => t.name));

  // Orden fijo por nombre: el bloque de herramientas es la primera parte del
  // prompt cacheado y tiene que salir igual en cada consulta.
  const definiciones: Anthropic.Tool[] = lectura
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      description: [t.title, t.description].filter(Boolean).join(". "),
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

  async function llamar(nombre: string, args: unknown) {
    if (!nombres.has(nombre)) {
      return { texto: `La herramienta "${nombre}" no está disponible en el asistente.`, error: true };
    }
    try {
      const res = await client.callTool({ name: nombre, arguments: (args ?? {}) as Record<string, unknown> });
      const bloques = Array.isArray(res.content) ? res.content : [];
      let texto = bloques
        .map((b) => (b && typeof b === "object" && "text" in b && typeof b.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join("\n");
      if (texto.length > MAX_RESULTADO) texto = `${texto.slice(0, MAX_RESULTADO)}\n[…resultado recortado]`;
      return { texto: texto || "(sin resultado)", error: res.isError === true };
    } catch (err) {
      return { texto: err instanceof Error ? err.message : String(err), error: true };
    }
  }

  return {
    definiciones,
    llamar,
    cerrar: async () => {
      await client.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    },
  };
}
