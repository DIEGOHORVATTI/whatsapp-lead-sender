import { Component, createRef, type RefObject } from 'react'
import { t } from '../../utils/i18n'
import type { AIConfig } from '../../types/AIConfig'
import { DEFAULT_AI_CONFIG } from '../../types/AIConfig'
import type { Attachment } from '../../types/Attachment'
import type {
  BatchConfig,
  Campaign,
  CampaignResult,
  MessageVariant,
  TimingConfig,
} from '../../types/Campaign'
import { DEFAULT_BATCH, DEFAULT_TIMING, normalizeVariant } from '../../types/Campaign'
import type { Lead } from '../../types/Lead'
import campaignManager from '../../utils/CampaignManager'
import campaignStorage from '../../utils/CampaignStorage'
import { generateMessage } from '../../utils/aiService'
import { replaceVariables } from '../../utils/templateEngine'
import Button from '../atoms/Button'
import { ControlInput } from '../atoms/ControlFactory'
import ConfigPanel from '../molecules/ConfigPanel'
import ContactInput from '../molecules/ContactInput'
import ContactPickerModal from '../molecules/ContactPickerModal'
import PreviewBubble from '../molecules/PreviewBubble'
import VariableToolbar from '../molecules/VariableToolbar'

interface UnifiedEditorProps {
  className?: string
  onCampaignStart?: (campaign: Campaign, leads: Lead[]) => void
  onCampaignSave?: () => void
  initialCampaign?: Campaign | null
}

interface UnifiedEditorState {
  // Campaign config
  name: string
  leads: Lead[]
  variants: MessageVariant[]
  activeVariantIndex: number
  timing: TimingConfig
  batch: BatchConfig
  aiConfig: AIConfig
  attachment?: Attachment | null

  // Preview
  previewLeadIndex: number
  aiPreviewMessage: string
  aiPreviewLoading: boolean

  // Full preview
  showFullPreview: boolean
  fullPreviewResults: CampaignResult[]
  fullPreviewLoading: boolean
  fullPreviewSearch: string

  // Schedule check
  outsideSchedule: boolean
  scheduleReason: string

  // Contact picker
  showContactPicker: boolean
}

export default class UnifiedEditor extends Component<UnifiedEditorProps, UnifiedEditorState> {
  private textareaRefs: Record<string, RefObject<HTMLTextAreaElement>> = {}
  private scheduleCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor(props: UnifiedEditorProps) {
    super(props)
    const ic = props.initialCampaign
    const defaultTemplates = [
      'Olá {decisor}! Vi que a {nome_fantasia} atua em {segmento} em {cidade}. Temos uma solução que reduz faltas de pacientes em até 70%. Posso te mostrar?',
    ]
    this.state = {
      name: ic?.name ?? `${t('campaign')} ${new Date().toLocaleDateString()}`,
      leads: [],
      variants: ic?.variants.map(normalizeVariant) ?? [
        {
          id: crypto.randomUUID(),
          name: t('variant_a'),
          template: defaultTemplates[0]!,
          templates: defaultTemplates,
          useAI: false,
        },
      ],
      activeVariantIndex: 0,
      timing: ic?.timing ?? { ...DEFAULT_TIMING },
      batch: ic?.batch ?? { ...DEFAULT_BATCH },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      attachment: undefined,
      previewLeadIndex: 0,
      aiPreviewMessage: '',
      aiPreviewLoading: false,
      showFullPreview: false,
      fullPreviewResults: [],
      fullPreviewLoading: false,
      fullPreviewSearch: '',
      outsideSchedule: false,
      scheduleReason: '',
      showContactPicker: false,
    }
  }

  override componentDidMount() {
    const ic = this.props.initialCampaign
    if (ic) {
      // Load leads from storage for the editing campaign
      void this.loadCampaignLeads(ic.leadIds)
      // Still load AI config from storage
      chrome.storage.local.get(['aiConfig'], (data: Record<string, unknown>) => {
        if (data['aiConfig']) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          this.setState({ aiConfig: data['aiConfig'] as AIConfig }, () => {
            this.checkSchedule()
          })
        } else {
          this.checkSchedule()
        }
      })
    } else {
      chrome.storage.local.get(
        ['aiConfig', 'editorTiming', 'editorBatch', 'editorName', 'editorVariants'],
        (data: Record<string, unknown>) => {
          const updates: Partial<UnifiedEditorState> = {}
          if (data['aiConfig']) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updates.aiConfig = data['aiConfig'] as AIConfig
          }
          if (data['editorTiming']) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updates.timing = data['editorTiming'] as TimingConfig
          }
          if (data['editorBatch']) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updates.batch = data['editorBatch'] as BatchConfig
          }
          if (data['editorName']) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updates.name = data['editorName'] as string
          }
          if (data['editorVariants']) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updates.variants = data['editorVariants'] as MessageVariant[]
          }
          if (Object.keys(updates).length > 0) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            this.setState(updates as UnifiedEditorState, () => {
              this.checkSchedule()
            })
          } else {
            this.checkSchedule()
          }
        }
      )
    }
    this.scheduleCheckInterval = setInterval(() => {
      this.checkSchedule()
    }, 60_000)
  }

  private async loadCampaignLeads(leadIds: string[]) {
    const leads = await campaignStorage.getLeads(leadIds)
    this.setState({ leads })
  }

  override componentWillUnmount() {
    if (this.scheduleCheckInterval) {
      clearInterval(this.scheduleCheckInterval)
    }
  }

  private checkSchedule() {
    const { timing } = this.state
    const { schedule } = timing
    if (!schedule.enabled) {
      this.setState({ outsideSchedule: false, scheduleReason: '' })
      return
    }
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    const dayNames = [t('day_sun'), t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat')]
    const allowedDays = schedule.daysOfWeek.map((d) => dayNames[d]).join(', ')

    if (!schedule.daysOfWeek.includes(day)) {
      this.setState({
        outsideSchedule: true,
        scheduleReason: t('today_not_allowed', { day: dayNames[day] ?? '', allowedDays }),
      })
      return
    }
    if (hour < schedule.startHour || hour >= schedule.endHour) {
      this.setState({
        outsideSchedule: true,
        scheduleReason: t('outside_schedule', { start: String(schedule.startHour), end: String(schedule.endHour), current: String(hour) }),
      })
      return
    }
    this.setState({ outsideSchedule: false, scheduleReason: '' })
  }

  private persistConfig(partial: Partial<Record<string, unknown>> = {}) {
    const toSave: Record<string, unknown> = { ...partial }
    void chrome.storage.local.set(toSave)
  }

  // --- Variant management ---

  private addVariant = () => {
    const { variants } = this.state
    if (variants.length >= 4) return
    const letter = String.fromCharCode(65 + variants.length)
    const newVariants: MessageVariant[] = [
      ...variants,
      {
        id: crypto.randomUUID(),
        name: `${t('variant')} ${letter}`,
        template: '',
        templates: [''],
        useAI: false,
      },
    ]
    this.setState({ variants: newVariants })
    this.persistConfig({ editorVariants: newVariants })
  }

  private removeVariant = (index: number) => {
    const variants = this.state.variants.filter((_, i) => i !== index)
    this.setState({
      variants,
      activeVariantIndex: Math.min(this.state.activeVariantIndex, variants.length - 1),
    })
    this.persistConfig({ editorVariants: variants })
  }

  private updateVariant = (index: number, updates: Partial<MessageVariant>) => {
    const variants = this.state.variants.map((v, i) => (i === index ? { ...v, ...updates } : v))
    this.setState({
      variants,
      aiPreviewMessage: '',
    })
    this.persistConfig({ editorVariants: variants })
  }

  private insertVariable = (variable: string) => {
    const { activeVariantIndex, variants } = this.state
    const variant = variants[activeVariantIndex]
    if (!variant) return
    // Find which textarea is focused (by checking activeElement)
    const active = document.activeElement as HTMLTextAreaElement | null
    if (!active || active.tagName !== 'TEXTAREA') return
    const start = active.selectionStart
    const end = active.selectionEnd
    const currentText = active.value
    const newText = currentText.slice(0, start) + variable + currentText.slice(end)

    // Find which template index this textarea belongs to
    const templates = [...(variant.templates.length > 0 ? variant.templates : [variant.template])]
    const tplIndex = templates.findIndex((_, i) => {
      const ref = this.textareaRefs[`${variant.id}-${String(i)}`]
      return ref?.current === active
    })
    if (tplIndex >= 0) {
      templates[tplIndex] = newText
      this.updateVariant(activeVariantIndex, { templates, template: templates[0] ?? '' })
    }
    requestAnimationFrame(() => {
      active.focus()
      active.setSelectionRange(start + variable.length, start + variable.length)
    })
  }

  private getTextareaRef(id: string): RefObject<HTMLTextAreaElement> {
    if (!this.textareaRefs[id]) {
      this.textareaRefs[id] = createRef<HTMLTextAreaElement>()
    }
    return this.textareaRefs[id]
  }

  // --- Preview ---

  private getPreviewMessages(): string[] {
    const { variants, activeVariantIndex, leads, previewLeadIndex } = this.state
    const variant = variants[activeVariantIndex]
    if (!variant) return ['']
    const templates = variant.templates.length > 0 ? variant.templates : [variant.template]
    if (leads.length === 0) return templates
    const lead = leads[previewLeadIndex]
    if (!lead) return templates
    return templates.filter((t) => t.trim()).map((t) => replaceVariables(t, lead))
  }

  private generateAIPreview = async () => {
    const { variants, activeVariantIndex, leads, previewLeadIndex, aiConfig } = this.state
    const variant = variants[activeVariantIndex]
    const lead = leads[previewLeadIndex]
    if (!variant || !lead || aiConfig.provider === 'none') return

    this.setState({ aiPreviewLoading: true })
    const tpl = variant.templates.length > 0 ? variant.templates.join('\n') : variant.template
    const resp = await generateMessage(aiConfig, lead, tpl)
    this.setState({
      aiPreviewMessage: resp.text ? resp.text : (resp.error ?? t('ai_error')),
      aiPreviewLoading: false,
    })
  }

  private handleLeadNav = (delta: number) => {
    const { leads, previewLeadIndex } = this.state
    if (leads.length === 0) return
    const next = (previewLeadIndex + delta + leads.length) % leads.length
    this.setState({ previewLeadIndex: next, aiPreviewMessage: '' })
  }

  // --- Full Preview ---

  private handleFullPreview = async () => {
    this.setState({ fullPreviewLoading: true, showFullPreview: true })
    const { name, variants, timing, batch, leads, aiConfig } = this.state
    const campaign = campaignManager.createCampaign(name, leads, variants)
    campaign.timing = timing
    campaign.batch = batch
    campaignManager.setAIConfig(aiConfig)
    const results = await campaignManager.preview(campaign, leads)
    this.setState({ fullPreviewResults: results, fullPreviewLoading: false })
  }

  // --- Campaign start (delegated to parent) ---

  private handleStart = () => {
    const { name, variants, timing, batch, leads, aiConfig } = this.state
    const campaign = campaignManager.createCampaign(name, leads, variants)
    campaign.timing = timing
    campaign.batch = batch
    campaignManager.setAIConfig(aiConfig)
    if (this.props.onCampaignStart) {
      this.props.onCampaignStart(campaign, leads)
    }
  }

  private handleSave = async () => {
    const { name, variants, timing, batch, leads } = this.state
    const ic = this.props.initialCampaign
    const campaign: Campaign = {
      id: ic?.id ?? crypto.randomUUID(),
      name,
      leadIds: leads.map((l) => l.id),
      variants,
      timing,
      batch,
      results: ic?.results ?? [],
      status: ic?.status === 'completed' ? 'draft' : (ic?.status ?? 'draft'),
      pauseReason: ic?.pauseReason,
      dailySentCount: ic?.dailySentCount ?? 0,
      dailyResetDate: ic?.dailyResetDate ?? new Date().toISOString().slice(0, 10),
      createdAt: ic?.createdAt ?? new Date().toISOString(),
    }
    await campaignStorage.saveCampaign(campaign)
    this.props.onCampaignSave?.()
  }

  // --- AI Config persistence ---

  private handleAIConfigChange = (config: AIConfig) => {
    this.setState({ aiConfig: config })
    this.persistConfig({ aiConfig: config })
  }

  override render() {
    const {
      name,
      leads,
      variants,
      activeVariantIndex,
      timing,
      batch,
      aiConfig,
      attachment,
      previewLeadIndex,
      aiPreviewMessage,
      aiPreviewLoading,
      showFullPreview,
      fullPreviewResults,
      fullPreviewLoading,
      fullPreviewSearch,
    } = this.state

    const activeVariant = variants[activeVariantIndex]
    const previewLead = leads[previewLeadIndex]
    const previewMessages =
      activeVariant?.useAI && aiPreviewMessage ? [aiPreviewMessage] : this.getPreviewMessages()

    // Full preview mode
    if (showFullPreview) {
      const searchLower = fullPreviewSearch.toLowerCase()
      const filtered = fullPreviewResults.filter(
        (r) =>
          !searchLower ||
          r.contact.includes(searchLower) ||
          (r.generatedMessage ?? '').toLowerCase().includes(searchLower)
      )

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{t('preview')} — {fullPreviewResults.length} msgs</h2>
            <button
              type="button"
              onClick={() => {
                this.setState({ showFullPreview: false })
              }}
              className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/8 hover:bg-primary/16 rounded-lg transition-colors"
            >
              {t('back')}
            </button>
          </div>

          {fullPreviewLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('generating_previews')}
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder={t('search')}
                value={fullPreviewSearch}
                onChange={(e) => {
                  this.setState({ fullPreviewSearch: e.target.value })
                }}
                className="px-2 py-1 text-xs border border-input rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {filtered.map((r, i) => (
                  <div key={i} className="border border-border rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.contact}
                      </span>
                      <span className="text-[10px] px-1 py-0.5 bg-secondary-lighter text-primary rounded font-medium">
                        {variants.find((v) => v.id === r.variantId)?.name ?? r.variantId}
                      </span>
                    </div>
                    <PreviewBubble
                      message={r.generatedMessage ?? ''}
                      attachmentName={attachment?.name}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <span
                  className="flex-1"
                  title={this.state.outsideSchedule ? this.state.scheduleReason : undefined}
                >
                  <Button
                    variant="primary"
                    onClick={this.handleStart}
                    disabled={this.state.outsideSchedule}
                    className="text-xs w-full"
                  >
                    {t('start')}
                  </Button>
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    this.setState({ showFullPreview: false })
                  }}
                  className="text-xs"
                >
                  {t('back')}
                </Button>
              </div>
            </>
          )}
        </div>
      )
    }

    // Main editor — single column for side panel
    return (
      <div className="flex flex-col gap-3">
        {/* Campaign name */}
        <ControlInput
          value={name}
          onChange={(e) => {
            this.setState({ name: e.target.value })
            this.persistConfig({ editorName: e.target.value })
          }}
          placeholder={t('campaign_name_placeholder')}
          className="text-sm"
        />

        {/* Contact input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                this.setState({ showContactPicker: true })
              }}
              className="text-xs flex-1"
            >
              {t('select_saved_contacts')} {leads.length > 0 ? `(${String(leads.length)})` : ''}
            </Button>
          </div>
          <ContactInput
            onLeadsChange={(newLeads) => {
              this.setState({
                leads: newLeads,
                previewLeadIndex: 0,
                aiPreviewMessage: '',
              })
              // Save imported leads to IDB for persistence
              void campaignStorage.saveLeadsDedup(newLeads)
            }}
          />
        </div>

        {this.state.showContactPicker && (
          <ContactPickerModal
            onSelect={(selectedLeads) => {
              this.setState({
                leads: selectedLeads,
                previewLeadIndex: 0,
                aiPreviewMessage: '',
                showContactPicker: false,
              })
            }}
            onClose={() => {
              this.setState({ showContactPicker: false })
            }}
          />
        )}

        {/* Config Panel */}
        <ConfigPanel
          timing={timing}
          batch={batch}
          aiConfig={aiConfig}
          attachment={attachment}
          onTimingChange={(t) => {
            this.setState({ timing: t }, () => {
              this.checkSchedule()
            })
            this.persistConfig({ editorTiming: t })
          }}
          onBatchChange={(b) => {
            this.setState({ batch: b })
            this.persistConfig({ editorBatch: b })
          }}
          onAIConfigChange={this.handleAIConfigChange}
          onAttachmentChange={(a) => {
            this.setState({ attachment: a })
          }}
        />

        {/* Variant Tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {variants.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                this.setState({
                  activeVariantIndex: i,
                  aiPreviewMessage: '',
                })
              }}
              className={`px-2 py-1 text-xs rounded-t-md border border-b-0 transition-colors ${
                activeVariantIndex === i
                  ? 'bg-card border-border font-medium text-foreground'
                  : 'bg-muted border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.name}
            </button>
          ))}
          {variants.length < 4 && (
            <button
              type="button"
              onClick={this.addVariant}
              className="w-7 h-7 flex items-center justify-center text-sm font-medium text-primary bg-primary/8 hover:bg-primary/16 rounded-lg transition-colors"
            >
              +
            </button>
          )}
        </div>

        {/* Active Variant Editor */}
        {activeVariant && (
          <div className="border border-border rounded-b-lg rounded-tr-lg p-2.5 bg-card -mt-3">
            <div className="flex items-center justify-between mb-2">
              <ControlInput
                value={activeVariant.name}
                onChange={(e) => {
                  this.updateVariant(activeVariantIndex, {
                    name: e.target.value,
                  })
                }}
                className="w-28 text-xs font-medium"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    this.updateVariant(activeVariantIndex, {
                      useAI: !activeVariant.useAI,
                    })
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                    activeVariant.useAI
                      ? 'bg-primary/12 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  IA
                </button>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      this.removeVariant(activeVariantIndex)
                    }}
                    className="w-6 h-6 flex items-center justify-center text-sm rounded-lg text-destructive bg-destructive/8 hover:bg-destructive/16 transition-colors"
                    title="Remover variante"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <VariableToolbar onInsert={this.insertVariable} />

            {(activeVariant.templates.length > 0 ? activeVariant.templates : [activeVariant.template]).map((tpl, tplIdx, arr) => (
              <div key={tplIdx} className="relative mt-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {t('msg_label')} {tplIdx + 1}
                  </span>
                  {arr.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const templates = activeVariant.templates.filter((_, i) => i !== tplIdx)
                        this.updateVariant(activeVariantIndex, {
                          templates,
                          template: templates[0] ?? '',
                        })
                      }}
                      className="w-5 h-5 flex items-center justify-center text-xs rounded-md text-destructive bg-destructive/8 hover:bg-destructive/16 transition-colors ml-auto"
                      title={t('remove_message')}
                    >
                      ×
                    </button>
                  )}
                </div>
                <textarea
                  ref={this.getTextareaRef(`${activeVariant.id}-${String(tplIdx)}`)}
                  value={tpl}
                  onChange={(e) => {
                    const templates = [...(activeVariant.templates.length > 0 ? activeVariant.templates : [activeVariant.template])]
                    templates[tplIdx] = e.target.value
                    this.updateVariant(activeVariantIndex, {
                      templates,
                      template: templates[0] ?? '',
                    })
                  }}
                  rows={3}
                  className="w-full bg-muted text-foreground border border-input p-2 rounded-lg text-sm focus:shadow-equal focus:shadow-ring focus:outline-none transition-shadow placeholder:text-muted-foreground"
                  placeholder={
                    activeVariant.useAI
                      ? `${t('msg_label')} ${tplIdx + 1}: ${t('ai_instructions_placeholder')}`
                      : `${t('msg_label')} ${tplIdx + 1}: ${t('template_placeholder')}`
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const templates = [...(activeVariant.templates.length > 0 ? activeVariant.templates : [activeVariant.template]), '']
                this.updateVariant(activeVariantIndex, { templates })
              }}
              className="mt-2 px-3 py-1.5 text-[11px] font-medium text-primary bg-primary/8 hover:bg-primary/16 rounded-lg transition-colors"
            >
              {t('add_message')}
            </button>

            {activeVariant.useAI && (
              <div
                style={{ cursor: 'default' }}
                title={
                  aiConfig.provider === 'none'
                    ? t('configure_ai_provider')
                    : !aiConfig.apiKey
                      ? t('add_api_key')
                      : leads.length === 0
                        ? t('add_contacts_first')
                        : undefined
                }
              >
                <Button
                  variant="info"
                  onClick={() => void this.generateAIPreview()}
                  disabled={aiPreviewLoading || leads.length === 0 || aiConfig.provider === 'none'}
                  style={aiPreviewLoading || leads.length === 0 || aiConfig.provider === 'none' ? { pointerEvents: 'none' } : undefined}
                  className="mt-2 text-xs"
                >
                  {aiPreviewLoading ? t('generating') : t('generate_with_ai')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Live Preview */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('preview')}
          </div>

          <div
            className="rounded-lg p-3 min-h-[120px] flex flex-col justify-end gap-2.5"
            style={{
              backgroundColor: '#efeae2',
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          >
            {previewMessages.map((msg, i) => (
              <PreviewBubble key={i} message={msg} attachmentName={i === 0 ? attachment?.name : undefined} />
            ))}
          </div>

          {/* Lead Navigator */}
          {leads.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    this.handleLeadNav(-1)
                  }}
                  className="w-7 h-7 flex items-center justify-center text-xs rounded-lg bg-primary/8 text-primary hover:bg-primary/16 transition-colors"
                >
                  ◀
                </button>
                <span className="text-xs text-muted-foreground font-mono min-w-[3rem] text-center">
                  {previewLeadIndex + 1} / {leads.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    this.handleLeadNav(1)
                  }}
                  className="w-7 h-7 flex items-center justify-center text-xs rounded-lg bg-primary/8 text-primary hover:bg-primary/16 transition-colors"
                >
                  ▶
                </button>
              </div>

              {previewLead && (
                <div className="bg-muted rounded-lg p-2 text-xs grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {previewLead.nome_fantasia && (
                    <>
                      <span className="text-muted-foreground">{t('name')}:</span>
                      <span className="font-medium truncate">{previewLead.nome_fantasia}</span>
                    </>
                  )}
                  {previewLead.decisor && (
                    <>
                      <span className="text-muted-foreground">{t('decision_maker')}:</span>
                      <span className="font-medium truncate">{previewLead.decisor}</span>
                    </>
                  )}
                  {previewLead.segmento && (
                    <>
                      <span className="text-muted-foreground">{t('segment')}:</span>
                      <span className="truncate">{previewLead.segmento}</span>
                    </>
                  )}
                  {previewLead.cidade && (
                    <>
                      <span className="text-muted-foreground">{t('city')}:</span>
                      <span className="truncate">
                        {previewLead.cidade}
                        {previewLead.uf ? `/${previewLead.uf}` : ''}
                      </span>
                    </>
                  )}
                  {previewLead.telefone && (
                    <>
                      <span className="text-muted-foreground">{t('phone_abbr')}:</span>
                      <span className="font-mono">{previewLead.telefone}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {leads.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-2">
              {t('import_contacts_preview')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <span
            className="flex-1"
            title={this.state.outsideSchedule ? this.state.scheduleReason : undefined}
          >
            <Button
              variant="primary"
              onClick={this.handleStart}
              disabled={
                leads.length === 0 ||
                variants.every((v) => v.templates.every((t) => !t.trim())) ||
                this.state.outsideSchedule
              }
              className="text-xs w-full"
            >
              {t('start_campaign')}
            </Button>
          </span>
          <Button
            variant="success"
            onClick={() => void this.handleSave()}
            disabled={variants.every((v) => v.templates.every((t) => !t.trim()))}
            className="text-xs"
          >
            {t('save')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void this.handleFullPreview()}
            disabled={
              leads.length === 0 || variants.every((v) => v.templates.every((t) => !t.trim())) || fullPreviewLoading
            }
            className="text-xs"
          >
            {fullPreviewLoading ? '...' : t('preview')}
          </Button>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground">
            {leads.length} {t('contacts')} · {variants.length} {variants.length > 1 ? t('variants_count_plural') : t('variants_count')}
          </span>
        </div>
      </div>
    )
  }
}
