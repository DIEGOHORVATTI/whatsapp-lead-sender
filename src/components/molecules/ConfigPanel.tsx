import { Component, createRef, type RefObject } from 'react'
import type { AIConfig } from '../../types/AIConfig'
import { AI_MODELS } from '../../types/AIConfig'
import type { Attachment } from '../../types/Attachment'
import type { BatchConfig, TimingConfig } from '../../types/Campaign'
import Button from '../atoms/Button'
import { ControlInput, ControlSelect, ControlTextArea } from '../atoms/ControlFactory'
import TimingControls from './TimingControls'
import { t } from '../../utils/i18n'

interface ConfigPanelProps {
  timing: TimingConfig
  batch: BatchConfig
  aiConfig: AIConfig
  attachment?: Attachment | null
  onTimingChange: (timing: TimingConfig) => void
  onBatchChange: (batch: BatchConfig) => void
  onAIConfigChange: (config: AIConfig) => void
  onAttachmentChange: (attachment?: Attachment | null) => void
}

interface ConfigPanelState {
  open: boolean
  activeSection: 'ai' | 'timing' | 'batch' | 'attachment'
}

export default class ConfigPanel extends Component<ConfigPanelProps, ConfigPanelState> {
  private fileRef: RefObject<HTMLInputElement> = createRef<HTMLInputElement>()

  constructor(props: ConfigPanelProps) {
    super(props)
    this.state = {
      open: false,
      activeSection: 'ai',
    }
  }

  private handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (!ev.target?.result) return
      const decoder = new TextDecoder('utf-8')
      this.props.onAttachmentChange({
        name: file.name,
        type: file.type,
        url:
          typeof ev.target.result === 'string'
            ? ev.target.result
            : decoder.decode(ev.target.result),
        lastModified: file.lastModified,
      })
    }
    reader.readAsDataURL(file)
  }

  override render() {
    const { timing, batch, aiConfig, attachment } = this.props
    const { open, activeSection } = this.state

    return (
      <div className="border border-border rounded-lg">
        {/* Toggle Header */}
        <button
          type="button"
          onClick={() => {
            this.setState({ open: !open })
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">⚙</span>
            {t('settings')}
            {aiConfig.provider !== 'none' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-secondary-lighter text-primary rounded">
                {t('ai')}: {aiConfig.provider}
              </span>
            )}
            {attachment && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">
                📎 {attachment.name}
              </span>
            )}
          </span>
          <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {open && (
          <div className="border-t border-border px-3 py-3">
            {/* Section Tabs */}
            <div className="flex flex-wrap gap-1 mb-3">
              {(
                [
                  ['ai', t('ai')],
                  ['timing', t('timing')],
                  ['batch', t('batches')],
                  ['attachment', t('attachment')],
                ] as [ConfigPanelState['activeSection'], string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    this.setState({ activeSection: key })
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    activeSection === key
                      ? 'bg-secondary-lighter text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* AI Section */}
            {activeSection === 'ai' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-20">{t('provider')}:</label>
                  <ControlSelect
                    value={aiConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as AIConfig['provider'] // eslint-disable-line @typescript-eslint/consistent-type-assertions
                      this.props.onAIConfigChange({
                        ...aiConfig,
                        provider,
                        model: AI_MODELS[e.target.value]?.models[0] ?? aiConfig.model,
                      })
                    }}
                    className="text-xs"
                  >
                    <option value="none">{t('disabled')}</option>
                    <option value="claude">Claude</option>
                    <option value="openai">OpenAI</option>
                  </ControlSelect>
                </div>
                {aiConfig.provider !== 'none' && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-20">{t('api_key')}:</label>
                      <ControlInput
                        type="password"
                        value={aiConfig.apiKey}
                        onChange={(e) => {
                          this.props.onAIConfigChange({
                            ...aiConfig,
                            apiKey: e.target.value,
                          })
                        }}
                        placeholder="sk-..."
                        className="text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-20">{t('model')}:</label>
                      <ControlSelect
                        value={aiConfig.model}
                        onChange={(e) => {
                          this.props.onAIConfigChange({
                            ...aiConfig,
                            model: e.target.value,
                          })
                        }}
                        className="text-xs"
                      >
                        {(AI_MODELS[aiConfig.provider]?.models ?? []).map((m: string) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </ControlSelect>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs">{t('base_prompt')}:</label>
                      <ControlTextArea
                        value={aiConfig.basePrompt}
                        onChange={(e) => {
                          this.props.onAIConfigChange({
                            ...aiConfig,
                            basePrompt: e.target.value,
                          })
                        }}
                        rows={4}
                        className="text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Timing Section */}
            {activeSection === 'timing' && (
              <TimingControls config={timing} onChange={this.props.onTimingChange} />
            )}

            {/* Batch Section */}
            {activeSection === 'batch' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32">{t('msgs_per_batch')}:</label>
                  <ControlInput
                    type="number"
                    min={1}
                    max={100}
                    value={batch.batchSize}
                    onChange={(e) => {
                      this.props.onBatchChange({
                        ...batch,
                        batchSize: Number(e.target.value),
                      })
                    }}
                    className="w-20 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={batch.pauseBetweenBatches}
                    onChange={(e) => {
                      this.props.onBatchChange({
                        ...batch,
                        pauseBetweenBatches: e.target.checked,
                      })
                    }}
                  />
                  {t('pause_between_batches_short')}
                </label>
              </div>
            )}

            {/* Attachment Section */}
            {activeSection === 'attachment' && (
              <div className="flex flex-col gap-2">
                <input
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                  ref={this.fileRef as React.LegacyRef<HTMLInputElement>}
                  type="file"
                  onChange={this.handleFileChange}
                  className="text-xs"
                />
                {attachment && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">📎 {attachment.name}</span>
                    <Button
                      variant="danger"
                      onClick={() => {
                        this.props.onAttachmentChange(null)
                        if (this.fileRef.current)
                          this.fileRef.current.files = new DataTransfer().files
                      }}
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      {t('remove')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
}
