import { Component, createRef, type RefObject } from "react";
import type { AIConfig } from "../../types/AIConfig";
import { DEFAULT_AI_CONFIG } from "../../types/AIConfig";
import type { Attachment } from "../../types/Attachment";
import type {
  BatchConfig,
  Campaign,
  CampaignResult,
  MessageVariant,
  TimingConfig,
} from "../../types/Campaign";
import { DEFAULT_BATCH, DEFAULT_TIMING } from "../../types/Campaign";
import type { Lead } from "../../types/Lead";
import campaignManager from "../../utils/CampaignManager";
import { generateMessage } from "../../utils/aiService";
import { replaceVariables } from "../../utils/templateEngine";
import Button from "../atoms/Button";
import { ControlInput } from "../atoms/ControlFactory";
import ConfigPanel from "../molecules/ConfigPanel";
import ContactInput from "../molecules/ContactInput";
import PreviewBubble from "../molecules/PreviewBubble";
import VariableToolbar from "../molecules/VariableToolbar";

interface UnifiedEditorProps {
  className?: string;
  onCampaignStart?: (campaign: Campaign, leads: Lead[]) => void;
}

interface UnifiedEditorState {
  // Campaign config
  name: string;
  leads: Lead[];
  variants: MessageVariant[];
  activeVariantIndex: number;
  timing: TimingConfig;
  batch: BatchConfig;
  aiConfig: AIConfig;
  attachment?: Attachment | null;

  // Preview
  previewLeadIndex: number;
  aiPreviewMessage: string;
  aiPreviewLoading: boolean;

  // Full preview
  showFullPreview: boolean;
  fullPreviewResults: CampaignResult[];
  fullPreviewLoading: boolean;
  fullPreviewSearch: string;
}

export default class UnifiedEditor extends Component<
  UnifiedEditorProps,
  UnifiedEditorState
> {
  private textareaRefs: Record<string, RefObject<HTMLTextAreaElement>> = {};

  constructor(props: UnifiedEditorProps) {
    super(props);
    this.state = {
      name: `Campanha ${new Date().toLocaleDateString("pt-BR")}`,
      leads: [],
      variants: [
        {
          id: crypto.randomUUID(),
          name: "Variante A",
          template:
            "Olá {decisor}! Vi que a {nome_fantasia} atua em {segmento} em {cidade}. Temos uma solução que reduz faltas de pacientes em até 70%. Posso te mostrar?",
          useAI: false,
        },
      ],
      activeVariantIndex: 0,
      timing: { ...DEFAULT_TIMING },
      batch: { ...DEFAULT_BATCH },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      attachment: undefined,
      previewLeadIndex: 0,
      aiPreviewMessage: "",
      aiPreviewLoading: false,
      showFullPreview: false,
      fullPreviewResults: [],
      fullPreviewLoading: false,
      fullPreviewSearch: "",
    };
  }

  override componentDidMount() {
    chrome.storage.local.get(["aiConfig"], (data: Record<string, unknown>) => {
      if (data["aiConfig"]) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        this.setState({ aiConfig: data["aiConfig"] as AIConfig });
      }
    });
  }

  // --- Variant management ---

  private addVariant = () => {
    const { variants } = this.state;
    if (variants.length >= 4) return;
    const letter = String.fromCharCode(65 + variants.length);
    this.setState({
      variants: [
        ...variants,
        {
          id: crypto.randomUUID(),
          name: `Variante ${letter}`,
          template: "",
          useAI: false,
        },
      ],
    });
  };

  private removeVariant = (index: number) => {
    const variants = this.state.variants.filter((_, i) => i !== index);
    this.setState({
      variants,
      activeVariantIndex: Math.min(
        this.state.activeVariantIndex,
        variants.length - 1,
      ),
    });
  };

  private updateVariant = (index: number, updates: Partial<MessageVariant>) => {
    this.setState({
      variants: this.state.variants.map((v, i) =>
        i === index ? { ...v, ...updates } : v,
      ),
      aiPreviewMessage: "",
    });
  };

  private insertVariable = (variable: string) => {
    const { activeVariantIndex, variants } = this.state;
    const variant = variants[activeVariantIndex];
    if (!variant) return;
    const ref = this.textareaRefs[variant.id];
    const el = ref?.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText =
      variant.template.slice(0, start) + variable + variant.template.slice(end);
    this.updateVariant(activeVariantIndex, { template: newText });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  private getTextareaRef(id: string): RefObject<HTMLTextAreaElement> {
    if (!this.textareaRefs[id]) {
      this.textareaRefs[id] = createRef<HTMLTextAreaElement>();
    }
    return this.textareaRefs[id];
  }

  // --- Preview ---

  private getPreviewMessage(): string {
    const { variants, activeVariantIndex, leads, previewLeadIndex } =
      this.state;
    const variant = variants[activeVariantIndex];
    if (!variant) return "";
    if (leads.length === 0) return variant.template;
    const lead = leads[previewLeadIndex];
    if (!lead) return variant.template;
    return replaceVariables(variant.template, lead);
  }

  private generateAIPreview = async () => {
    const { variants, activeVariantIndex, leads, previewLeadIndex, aiConfig } =
      this.state;
    const variant = variants[activeVariantIndex];
    const lead = leads[previewLeadIndex];
    if (!variant || !lead || aiConfig.provider === "none") return;

    this.setState({ aiPreviewLoading: true });
    const resp = await generateMessage(aiConfig, lead, variant.template);
    this.setState({
      aiPreviewMessage: resp.text ? resp.text : (resp.error ?? "Erro ao gerar"),
      aiPreviewLoading: false,
    });
  };

  private handleLeadNav = (delta: number) => {
    const { leads, previewLeadIndex } = this.state;
    if (leads.length === 0) return;
    const next = (previewLeadIndex + delta + leads.length) % leads.length;
    this.setState({ previewLeadIndex: next, aiPreviewMessage: "" });
  };

  // --- Full Preview ---

  private handleFullPreview = async () => {
    this.setState({ fullPreviewLoading: true, showFullPreview: true });
    const { name, variants, timing, batch, leads, aiConfig } = this.state;
    const campaign = campaignManager.createCampaign(name, leads, variants);
    campaign.timing = timing;
    campaign.batch = batch;
    campaignManager.setAIConfig(aiConfig);
    const results = await campaignManager.preview(campaign, leads);
    this.setState({ fullPreviewResults: results, fullPreviewLoading: false });
  };

  // --- Campaign start (delegated to parent) ---

  private handleStart = () => {
    const { name, variants, timing, batch, leads, aiConfig } = this.state;
    const campaign = campaignManager.createCampaign(name, leads, variants);
    campaign.timing = timing;
    campaign.batch = batch;
    campaignManager.setAIConfig(aiConfig);
    if (this.props.onCampaignStart) {
      this.props.onCampaignStart(campaign, leads);
    }
  };

  // --- AI Config persistence ---

  private handleAIConfigChange = (config: AIConfig) => {
    this.setState({ aiConfig: config });
    void chrome.storage.local.set({ aiConfig: config });
  };

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
    } = this.state;

    const activeVariant = variants[activeVariantIndex];
    const previewLead = leads[previewLeadIndex];
    const previewMessage =
      activeVariant?.useAI && aiPreviewMessage
        ? aiPreviewMessage
        : this.getPreviewMessage();

    // Full preview mode
    if (showFullPreview) {
      const searchLower = fullPreviewSearch.toLowerCase();
      const filtered = fullPreviewResults.filter(
        (r) =>
          !searchLower ||
          r.contact.includes(searchLower) ||
          (r.generatedMessage ?? "").toLowerCase().includes(searchLower),
      );

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Preview — {fullPreviewResults.length} msgs
            </h2>
            <button
              type="button"
              onClick={() => {
                this.setState({ showFullPreview: false });
              }}
              className="text-xs text-primary hover:underline"
            >
              Voltar
            </button>
          </div>

          {fullPreviewLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Gerando previews...
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Buscar..."
                value={fullPreviewSearch}
                onChange={(e) => {
                  this.setState({ fullPreviewSearch: e.target.value });
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
                        {variants.find((v) => v.id === r.variantId)?.name ??
                          r.variantId}
                      </span>
                    </div>
                    <PreviewBubble
                      message={r.generatedMessage ?? ""}
                      attachmentName={attachment?.name}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={this.handleStart}
                  className="text-xs flex-1"
                >
                  Iniciar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    this.setState({ showFullPreview: false });
                  }}
                  className="text-xs"
                >
                  Voltar
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    // Main editor — single column for side panel
    return (
      <div className="flex flex-col gap-3">
        {/* Campaign name */}
        <ControlInput
          value={name}
          onChange={(e) => {
            this.setState({ name: e.target.value });
          }}
          placeholder="Nome da campanha"
          className="text-sm"
        />

        {/* Contact input */}
        <ContactInput
          onLeadsChange={(newLeads) => {
            this.setState({
              leads: newLeads,
              previewLeadIndex: 0,
              aiPreviewMessage: "",
            });
          }}
        />

        {/* Config Panel */}
        <ConfigPanel
          timing={timing}
          batch={batch}
          aiConfig={aiConfig}
          attachment={attachment}
          onTimingChange={(t) => {
            this.setState({ timing: t });
          }}
          onBatchChange={(b) => {
            this.setState({ batch: b });
          }}
          onAIConfigChange={this.handleAIConfigChange}
          onAttachmentChange={(a) => {
            this.setState({ attachment: a });
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
                  aiPreviewMessage: "",
                });
              }}
              className={`px-2 py-1 text-xs rounded-t-md border border-b-0 transition-colors ${
                activeVariantIndex === i
                  ? "bg-card border-border font-medium text-foreground"
                  : "bg-muted border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.name}
            </button>
          ))}
          {variants.length < 4 && (
            <button
              type="button"
              onClick={this.addVariant}
              className="px-2 py-1 text-xs text-primary hover:bg-secondary-lighter/30 rounded"
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
                  });
                }}
                className="w-28 text-xs font-medium"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeVariant.useAI}
                    onChange={(e) => {
                      this.updateVariant(activeVariantIndex, {
                        useAI: e.target.checked,
                      });
                    }}
                  />
                  IA
                </label>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      this.removeVariant(activeVariantIndex);
                    }}
                    className="text-xs text-destructive hover:opacity-80"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <VariableToolbar onInsert={this.insertVariable} />

            <textarea
              ref={this.getTextareaRef(activeVariant.id)}
              value={activeVariant.template}
              onChange={(e) => {
                this.updateVariant(activeVariantIndex, {
                  template: e.target.value,
                });
              }}
              rows={5}
              className="w-full mt-2 bg-muted text-foreground border border-input p-2 rounded-lg text-sm focus:shadow-equal focus:shadow-ring focus:outline-none transition-shadow placeholder:text-muted-foreground"
              placeholder={
                activeVariant.useAI
                  ? "Instruções para a IA (pode usar {variáveis})..."
                  : "Template da mensagem com {variáveis}..."
              }
            />

            {activeVariant.useAI && (
              <Button
                variant="info"
                onClick={() => void this.generateAIPreview()}
                disabled={
                  aiPreviewLoading ||
                  leads.length === 0 ||
                  aiConfig.provider === "none"
                }
                className="mt-2 text-xs"
              >
                {aiPreviewLoading ? "Gerando..." : "Gerar com IA"}
              </Button>
            )}
          </div>
        )}

        {/* Live Preview */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Preview
          </div>

          <div
            className="rounded-lg p-3 min-h-[120px] flex flex-col justify-end"
            style={{
              backgroundColor: "#efeae2",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          >
            <PreviewBubble
              message={previewMessage}
              attachmentName={attachment?.name}
            />
          </div>

          {/* Lead Navigator */}
          {leads.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    this.handleLeadNav(-1);
                  }}
                  className="px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded hover:opacity-80"
                >
                  ◀
                </button>
                <span className="text-xs text-muted-foreground font-mono">
                  {previewLeadIndex + 1} / {leads.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    this.handleLeadNav(1);
                  }}
                  className="px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded hover:opacity-80"
                >
                  ▶
                </button>
              </div>

              {previewLead && (
                <div className="bg-muted rounded-lg p-2 text-xs grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {previewLead.nome_fantasia && (
                    <>
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="font-medium truncate">
                        {previewLead.nome_fantasia}
                      </span>
                    </>
                  )}
                  {previewLead.decisor && (
                    <>
                      <span className="text-muted-foreground">Decisor:</span>
                      <span className="font-medium truncate">
                        {previewLead.decisor}
                      </span>
                    </>
                  )}
                  {previewLead.segmento && (
                    <>
                      <span className="text-muted-foreground">Segmento:</span>
                      <span className="truncate">{previewLead.segmento}</span>
                    </>
                  )}
                  {previewLead.cidade && (
                    <>
                      <span className="text-muted-foreground">Cidade:</span>
                      <span className="truncate">
                        {previewLead.cidade}
                        {previewLead.uf ? `/${previewLead.uf}` : ""}
                      </span>
                    </>
                  )}
                  {previewLead.telefone && (
                    <>
                      <span className="text-muted-foreground">Tel:</span>
                      <span className="font-mono">{previewLead.telefone}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {leads.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-2">
              Importe contatos para ver o preview
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            variant="primary"
            onClick={this.handleStart}
            disabled={
              leads.length === 0 || variants.every((v) => !v.template.trim())
            }
            className="text-xs flex-1"
          >
            Iniciar Campanha
          </Button>
          <Button
            variant="secondary"
            onClick={() => void this.handleFullPreview()}
            disabled={
              leads.length === 0 ||
              variants.every((v) => !v.template.trim()) ||
              fullPreviewLoading
            }
            className="text-xs"
          >
            {fullPreviewLoading ? "..." : "Preview"}
          </Button>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground">
            {leads.length} contatos · {variants.length} variante
            {variants.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    );
  }
}
