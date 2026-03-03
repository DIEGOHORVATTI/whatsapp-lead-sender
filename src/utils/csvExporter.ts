import type { Campaign, CampaignResult } from "../types/Campaign";
import type { Lead } from "../types/Lead";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCampaignResults(
  campaign: Campaign,
  leads: Lead[],
): string {
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const variantMap = new Map(campaign.variants.map((v) => [v.id, v.name]));

  const headers = [
    "telefone",
    "nome_fantasia",
    "decisor",
    "segmento",
    "cidade",
    "uf",
    "variante",
    "status",
    "mensagem_enviada",
    "enviado_em",
    "erro",
  ];

  const rows = campaign.results.map((r: CampaignResult) => {
    const lead = leadMap.get(r.leadId);
    return [
      r.contact,
      lead?.nome_fantasia || "",
      lead?.decisor || "",
      lead?.segmento || "",
      lead?.cidade || "",
      lead?.uf || "",
      variantMap.get(r.variantId) || "",
      r.status,
      r.generatedMessage || "",
      r.sentAt || "",
      r.error || "",
    ]
      .map(escapeCSV)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
