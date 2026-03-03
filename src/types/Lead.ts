export interface Lead {
  id: string;
  segmento: string;
  cnae: string;
  nome_fantasia: string;
  decisor: string;
  cargo: string;
  email: string;
  telefone: string;
  telefone_2: string;
  razao_social: string;
  cnpj: string;
  porte: string;
  capital_social: string;
  dias_abertura: string;
  data_inicio_atividade: string;
  cidade: string;
  uf: string;
  bairro: string;
  endereco: string;
  cep: string;
  [key: string]: string;
}

export const LEAD_FIELDS: { key: keyof Lead; label: string }[] = [
  { key: "nome_fantasia", label: "Nome Fantasia" },
  { key: "decisor", label: "Decisor" },
  { key: "cargo", label: "Cargo" },
  { key: "segmento", label: "Segmento" },
  { key: "telefone", label: "Telefone" },
  { key: "telefone_2", label: "Telefone 2" },
  { key: "email", label: "Email" },
  { key: "razao_social", label: "Razão Social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "bairro", label: "Bairro" },
  { key: "endereco", label: "Endereço" },
  { key: "cep", label: "CEP" },
  { key: "porte", label: "Porte" },
  { key: "capital_social", label: "Capital Social" },
  { key: "dias_abertura", label: "Dias Abertura" },
  { key: "cnae", label: "CNAE" },
];
