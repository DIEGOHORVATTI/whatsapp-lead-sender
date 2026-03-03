import { describe, it, expect } from "vitest";
import { replaceVariables, extractVariables, formatPhone } from "./templateEngine";
import type { Lead } from "../types/Lead";

const mockLead: Lead = {
  id: "1",
  segmento: "Tech",
  cnae: "6201-5/00",
  nome_fantasia: "Acme Corp",
  decisor: "João Silva",
  cargo: "CEO",
  email: "joao@acme.com",
  telefone: "11999887766",
  telefone_2: "1133224455",
  razao_social: "Acme Corp LTDA",
  cnpj: "12.345.678/0001-90",
  porte: "ME",
  capital_social: "100000",
  dias_abertura: "365",
  data_inicio_atividade: "2020-01-01",
  cidade: "São Paulo",
  uf: "SP",
  bairro: "Centro",
  endereco: "Rua A, 123",
  cep: "01001-000",
};

describe("replaceVariables", () => {
  it("should replace single variable", () => {
    expect(replaceVariables("Olá {decisor}!", mockLead)).toBe("Olá João Silva!");
  });

  it("should replace multiple variables", () => {
    expect(replaceVariables("{decisor} da {nome_fantasia}", mockLead)).toBe(
      "João Silva da Acme Corp",
    );
  });

  it("should replace missing variable with empty string", () => {
    expect(replaceVariables("Olá {inexistente}!", mockLead)).toBe("Olá !");
  });

  it("should return template unchanged when no variables", () => {
    expect(replaceVariables("Sem variáveis aqui", mockLead)).toBe("Sem variáveis aqui");
  });

  it("should handle empty template", () => {
    expect(replaceVariables("", mockLead)).toBe("");
  });
});

describe("extractVariables", () => {
  it("should extract all variables from template", () => {
    expect(extractVariables("{decisor} - {nome_fantasia} ({cidade})")).toEqual([
      "decisor",
      "nome_fantasia",
      "cidade",
    ]);
  });

  it("should return unique variables only", () => {
    expect(extractVariables("{nome} e {nome}")).toEqual(["nome"]);
  });

  it("should return empty array for no variables", () => {
    expect(extractVariables("Texto puro")).toEqual([]);
  });
});

describe("formatPhone", () => {
  it("should strip non-digits", () => {
    expect(formatPhone("(11) 99988-7766")).toBe("5511999887766");
  });

  it("should not double-prepend country code", () => {
    expect(formatPhone("5511999887766")).toBe("5511999887766");
  });

  it("should prepend default country code 55", () => {
    expect(formatPhone("11999887766")).toBe("5511999887766");
  });

  it("should use custom country code", () => {
    expect(formatPhone("234567890", "1")).toBe("1234567890");
  });

  it("should return empty for empty input", () => {
    expect(formatPhone("")).toBe("");
  });

  it("should return empty for non-digit input", () => {
    expect(formatPhone("abc")).toBe("");
  });
});
