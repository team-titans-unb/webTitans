import * as z from "zod";

// Opções do campo "por onde nos conheceu", reaproveitadas pelos dois formulários.
export const ORIGENS_CONTATO = [
  "Instagram",
  "Indicação de amigo",
  "Cartazes pela FCTE",
  "Evento",
  "Outro",
] as const;

const nome = z.string().min(3, "Digite seu nome completo.");
const email = z.string().email("E-mail inválido.");
const telefone = z
  .string()
  .min(8, "Digite um telefone válido com DDD.")
  .max(20, "Telefone muito longo.");
const origem = z.enum(ORIGENS_CONTATO, {
  required_error: "Selecione uma opção.",
});

// Formulário "Preciso de modelagem".
export const modelagemSchema = z.object({
  nome,
  email,
  telefone,
  origem,
  descricao: z
    .string()
    .min(20, "Descreva sua ideia com um pouco mais de detalhe (mín. 20 caracteres)."),
});

export type ModelagemFormValues = z.infer<typeof modelagemSchema>;

// Formulário "Já tenho os arquivos".
export const arquivosSchema = z.object({
  nome,
  email,
  telefone,
  origem,
  qualidade: z.string().optional(),
  observacoes: z.string().optional(),
});

export type ArquivosFormValues = z.infer<typeof arquivosSchema>;
