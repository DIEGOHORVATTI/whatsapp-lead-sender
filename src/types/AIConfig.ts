export interface AIConfig {
  provider: 'claude' | 'openai' | 'none'
  apiKey: string
  model: string
  basePrompt: string
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'none',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  basePrompt: `Você é um assistente de vendas para uma empresa de tecnologia que oferece um sistema de confirmação de consultas por WhatsApp para clínicas de saúde.

O sistema reduz no-shows (faltas) em até 70%, custando R$297-497/mês.

Gere uma mensagem curta e personalizada (máx 3 parágrafos) para o decisor da clínica, usando os dados fornecidos. Seja direto, profissional e mostre que conhece o segmento dele.`,
}

export const AI_MODELS: Record<string, { label: string; models: string[] }> = {
  claude: {
    label: 'Claude (Anthropic)',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
}
