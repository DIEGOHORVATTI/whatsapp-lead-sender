import { Component, createRef, type RefObject } from 'react'
import { t } from '../../utils/i18n'
import type { AIConfig } from '../../types/AIConfig'
import { AI_MODELS, DEFAULT_AI_CONFIG } from '../../types/AIConfig'
import type {
  BatchConfig,
  Campaign,
  CampaignResult,
  MessageVariant,
  TimingConfig,
} from '../../types/Campaign'
import { DEFAULT_BATCH, DEFAULT_TIMING } from '../../types/Campaign'
import type { Lead } from '../../types/Lead'
import campaignManager from '../../utils/CampaignManager'
import Button from '../atoms/Button'
import { ControlInput, ControlSelect, ControlTextArea } from '../atoms/ControlFactory'
import Box from '../molecules/Box'
import TimingControls from '../molecules/TimingControls'
import VariableToolbar from '../molecules/VariableToolbar'

interface CampaignEditorProps {
  leads: Lead[]
  onStart: (campaign: Campaign) => void
  onPreview: (results: CampaignResult[]) => void
}

interface CampaignEditorState {
  name: string
  variants: MessageVariant[]
  timing: TimingConfig
  batch: BatchConfig
  aiConfig: AIConfig
  activeTab: 'variants' | 'ai' | 'timing' | 'batch'
  previewing: boolean
}

export default class CampaignEditor extends Component<CampaignEditorProps, CampaignEditorState> {
  private textareaRefs: Record<string, RefObject<HTMLTextAreaElement>> = {}

  constructor(props: CampaignEditorProps) {
    super(props)
    this.state = {
      name: `${t('campaign')} ${new Date().toLocaleDateString()}`,
      variants: [
        {
          id: crypto.randomUUID(),
          name: t('variant_a'),
          template:
            'Olá {decisor}! Vi que a {nome_fantasia} atua em {segmento} em {cidade}. Temos uma solução que reduz faltas de pacientes em até 70%. Posso te mostrar?',
          templates: ['Olá {decisor}! Vi que a {nome_fantasia} atua em {segmento} em {cidade}. Temos uma solução que reduz faltas de pacientes em até 70%. Posso te mostrar?'],
          useAI: false,
        },
      ],
      timing: { ...DEFAULT_TIMING },
      batch: { ...DEFAULT_BATCH },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      activeTab: 'variants',
      previewing: false,
    }
  }

  override componentDidMount() {
    chrome.storage.local.get(['aiConfig'], (data: Record<string, unknown>) => {
      if (data['aiConfig']) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        this.setState({ aiConfig: data['aiConfig'] as AIConfig })
      }
    })
  }

  private addVariant = () => {
    const { variants } = this.state
    if (variants.length >= 4) return
    const letter = String.fromCharCode(65 + variants.length)
    this.setState({
      variants: [
        ...variants,
        {
          id: crypto.randomUUID(),
          name: `${t('variant')} ${letter}`,
          template: '',
          templates: [''],
          useAI: false,
        },
      ],
    })
  }

  private removeVariant = (id: string) => {
    this.setState({
      variants: this.state.variants.filter((v) => v.id !== id),
    })
  }

  private updateVariant = (id: string, updates: Partial<MessageVariant>) => {
    this.setState({
      variants: this.state.variants.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })
  }

  private insertVariable = (variantId: string, variable: string) => {
    const ref = this.textareaRefs[variantId]
    const el = ref?.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const variant = this.state.variants.find((v) => v.id === variantId)
    if (!variant) return
    const newText = variant.template.slice(0, start) + variable + variant.template.slice(end)
    this.updateVariant(variantId, { template: newText })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    })
  }

  private handleStart = () => {
    const { name, variants, timing, batch } = this.state
    const campaign = campaignManager.createCampaign(name, this.props.leads, variants)
    campaign.timing = timing
    campaign.batch = batch
    campaignManager.setAIConfig(this.state.aiConfig)
    this.props.onStart(campaign)
  }

  private handlePreview = async () => {
    this.setState({ previewing: true })
    const { name, variants, timing, batch, aiConfig } = this.state
    const campaign = campaignManager.createCampaign(name, this.props.leads, variants)
    campaign.timing = timing
    campaign.batch = batch
    campaignManager.setAIConfig(aiConfig)
    const results = await campaignManager.preview(campaign, this.props.leads)
    this.setState({ previewing: false })
    this.props.onPreview(results)
  }

  private saveAIConfig = (config: AIConfig) => {
    this.setState({ aiConfig: config })
    void chrome.storage.local.set({ aiConfig: config })
  }

  private getTextareaRef(id: string): RefObject<HTMLTextAreaElement> {
    if (!this.textareaRefs[id]) {
      this.textareaRefs[id] = createRef<HTMLTextAreaElement>()
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.textareaRefs[id]
  }

  override render() {
    const { leads } = this.props
    const { name, variants, timing, batch, aiConfig, activeTab, previewing } = this.state

    return (
      <Box title={`${t('campaign')} — ${String(leads.length)} leads`} className="max-w-3xl">
        <div className="p-4 flex flex-col gap-4">
          {/* Campaign Name */}
          <ControlInput
            value={name}
            onChange={(e) => {
              this.setState({ name: e.target.value })
            }}
            placeholder={t('campaign_name_placeholder')}
          />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {(
              [
                ['variants', t('messages')],
                ['ai', t('ai')],
                ['timing', t('timing')],
                ['batch', t('batches')],
              ] as [CampaignEditorState['activeTab'], string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  this.setState({ activeTab: key })
                }}
                className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
                {key === 'variants' && ` (${String(variants.length)})`}
              </button>
            ))}
          </div>

          {/* Tab: Variants */}
          {activeTab === 'variants' && (
            <div className="flex flex-col gap-3">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="border border-slate-200 dark:border-slate-700 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <ControlInput
                      value={v.name}
                      onChange={(e) => {
                        this.updateVariant(v.id, { name: e.target.value })
                      }}
                      className="w-40 text-sm font-medium"
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={v.useAI}
                          onChange={(e) => {
                            this.updateVariant(v.id, {
                              useAI: e.target.checked,
                            })
                          }}
                        />
                        {t('use_ai')}
                      </label>
                      {variants.length > 1 && (
                        <Button
                          variant="danger"
                          onClick={() => {
                            this.removeVariant(v.id)
                          }}
                          className="text-xs px-2 py-1"
                        >
                          {t('remove')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <VariableToolbar
                    onInsert={(variable) => {
                      this.insertVariable(v.id, variable)
                    }}
                  />
                  <textarea
                    ref={this.getTextareaRef(v.id)}
                    value={v.template}
                    onChange={(e) => {
                      this.updateVariant(v.id, { template: e.target.value })
                    }}
                    rows={4}
                    className="w-full flex-auto bg-slate-100 dark:bg-slate-900 border border-slate-400 dark:border-slate-600 p-1 rounded-lg transition-shadow ease-in-out duration-150 focus:shadow-equal focus:shadow-blue-800 dark:focus:shadow-blue-200 focus:outline-none mt-2 text-sm"
                    placeholder={
                      v.useAI
                        ? t('ai_instructions_placeholder')
                        : t('template_placeholder')
                    }
                  />
                </div>
              ))}
              {variants.length < 4 && (
                <Button
                  variant="secondary"
                  onClick={this.addVariant}
                  className="text-sm self-start"
                >
                  {t('add_variant_ab')}
                </Button>
              )}
            </div>
          )}

          {/* Tab: AI */}
          {activeTab === 'ai' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm w-24">{t('provider')}</label>
                <ControlSelect
                  value={aiConfig.provider}
                  onChange={(e) => {
                    this.saveAIConfig({
                      ...aiConfig,
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                      provider: e.target.value as AIConfig['provider'],
                      model: AI_MODELS[e.target.value]?.models[0] ?? aiConfig.model,
                    })
                  }}
                >
                  <option value="none">{t('disabled')}</option>
                  <option value="claude">{t('claude_anthropic')}</option>
                  <option value="openai">OpenAI</option>
                </ControlSelect>
              </div>
              {aiConfig.provider !== 'none' && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm w-24">{t('api_key')}</label>
                    <ControlInput
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) => {
                        this.saveAIConfig({
                          ...aiConfig,
                          apiKey: e.target.value,
                        })
                      }}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm w-24">{t('model')}</label>
                    <ControlSelect
                      value={aiConfig.model}
                      onChange={(e) => {
                        this.saveAIConfig({
                          ...aiConfig,
                          model: e.target.value,
                        })
                      }}
                    >
                      {(AI_MODELS[aiConfig.provider]?.models ?? []).map((m: string) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </ControlSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm">{t('base_prompt')}</label>
                    <ControlTextArea
                      value={aiConfig.basePrompt}
                      onChange={(e) => {
                        this.saveAIConfig({
                          ...aiConfig,
                          basePrompt: e.target.value,
                        })
                      }}
                      rows={5}
                      className="text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Timing */}
          {activeTab === 'timing' && (
            <TimingControls
              config={timing}
              onChange={(tc) => {
                this.setState({ timing: tc })
              }}
            />
          )}

          {/* Tab: Batch */}
          {activeTab === 'batch' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm w-40">{t('msgs_per_batch')}</label>
                <ControlInput
                  type="number"
                  min={1}
                  max={100}
                  value={batch.batchSize}
                  onChange={(e) => {
                    this.setState({
                      batch: { ...batch, batchSize: Number(e.target.value) },
                    })
                  }}
                  className="w-24"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={batch.pauseBetweenBatches}
                  onChange={(e) => {
                    this.setState({
                      batch: {
                        ...batch,
                        pauseBetweenBatches: e.target.checked,
                      },
                    })
                  }}
                />
                {t('pause_between_batches')}
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="primary"
              onClick={this.handleStart}
              disabled={leads.length === 0 || variants.every((v) => !v.template.trim())}
            >
              {t('start_campaign')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void this.handlePreview()}
              disabled={
                leads.length === 0 || variants.every((v) => !v.template.trim()) || previewing
              }
            >
              {previewing ? t('generating') : t('preview_dry_run')}
            </Button>
          </div>
        </div>
      </Box>
    )
  }
}
