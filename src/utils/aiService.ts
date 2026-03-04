import type { AIConfig } from '../types/AIConfig'
import type { Lead } from '../types/Lead'

interface AIResponse {
  text: string
  error?: string
}

function buildLeadContext(lead: Lead): string {
  const parts: string[] = []
  if (lead.nome_fantasia) parts.push(`Clínica: ${lead.nome_fantasia}`)
  if (lead.decisor) parts.push(`Decisor: ${lead.decisor}`)
  if (lead.cargo) parts.push(`Cargo: ${lead.cargo}`)
  if (lead.segmento) parts.push(`Segmento: ${lead.segmento}`)
  if (lead.cidade && lead.uf) parts.push(`Local: ${lead.cidade}/${lead.uf}`)
  if (lead.dias_abertura) parts.push(`Empresa aberta há ${lead.dias_abertura} dias`)
  if (lead.capital_social) parts.push(`Capital social: R$ ${lead.capital_social}`)
  return parts.join('\n')
}

async function callClaude(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { text: '', error: `Claude API ${String(res.status)}: ${err}` }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: { content?: { text?: string }[] } = await res.json()
  const text = data.content?.[0]?.text ?? ''
  return { text }
}

async function callOpenAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { text: '', error: `OpenAI API ${String(res.status)}: ${err}` }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: { choices?: { message?: { content?: string } }[] } = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return { text }
}

export async function generateMessage(
  config: AIConfig,
  lead: Lead,
  templateHint?: string
): Promise<AIResponse> {
  if (config.provider === 'none' || !config.apiKey) {
    return { text: '', error: 'AI not configured' }
  }

  const leadContext = buildLeadContext(lead)
  const userPrompt = templateHint
    ? `Dados do lead:\n${leadContext}\n\nBase para a mensagem:\n${templateHint}\n\nGere a mensagem personalizada:`
    : `Dados do lead:\n${leadContext}\n\nGere uma mensagem de prospecção personalizada:`

  if (config.provider === 'claude') {
    return callClaude(config, config.basePrompt, userPrompt)
  }
  return callOpenAI(config, config.basePrompt, userPrompt)
}
