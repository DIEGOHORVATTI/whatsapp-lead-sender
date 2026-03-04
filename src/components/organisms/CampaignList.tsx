import { Component } from 'react'
import type { Campaign } from '../../types/Campaign'
import campaignStorage from '../../utils/CampaignStorage'
import Button from '../atoms/Button'
import { t } from '../../utils/i18n'

interface CampaignListProps {
  onNewCampaign: () => void
  onSelectCampaign: (campaign: Campaign) => void
  onEditCampaign: (campaign: Campaign) => void
  onDeleteCampaign?: (id: string) => void
}

interface CampaignListState {
  campaigns: Campaign[]
  loading: boolean
}

function getStatusLabels(): Record<string, { label: string; className: string }> {
  return {
    draft: { label: t('status_draft'), className: 'bg-muted text-muted-foreground' },
    running: { label: t('status_running'), className: 'bg-success/80 text-white' },
    paused: { label: t('status_paused'), className: 'bg-warning/80 text-white' },
    completed: { label: t('status_completed'), className: 'bg-primary/80 text-white' },
    preview: { label: t('status_preview'), className: 'bg-muted text-muted-foreground' },
  }
}

export default class CampaignList extends Component<CampaignListProps, CampaignListState> {
  constructor(props: CampaignListProps) {
    super(props)
    this.state = { campaigns: [], loading: true }
  }

  override componentDidMount() {
    void this.load()
  }

  private async load() {
    this.setState({ loading: true })
    const campaigns = await campaignStorage.listCampaigns()

    // Auto-reset stuck "running" campaigns silently
    for (const c of campaigns) {
      if (c.status === 'running') {
        c.status = 'paused'
        c.pauseReason = undefined
        await campaignStorage.saveCampaign(c)
      }
    }

    // Sort by creation date, newest first
    campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    this.setState({ campaigns, loading: false })
  }

  private handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await campaignStorage.deleteCampaign(id)
    this.props.onDeleteCampaign?.(id)
    await this.load()
  }

  private handleCopy = async (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation()
    const copy: Campaign = {
      ...campaign,
      id: crypto.randomUUID(),
      name: `${campaign.name} (${t('copy_suffix')})`,
      status: 'draft',
      results: [],
      pauseReason: undefined,
      dailySentCount: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    }
    await campaignStorage.saveCampaign(copy)
    await this.load()
  }

  private handleEdit = (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation()
    this.props.onEditCampaign(campaign)
  }

  override render() {
    const { onNewCampaign, onSelectCampaign } = this.props
    const { campaigns, loading } = this.state

    return (
      <div className="flex flex-col gap-3 p-3">
        <Button variant="primary" onClick={onNewCampaign} className="text-sm w-full">
          {t('new_campaign')}
        </Button>

        {loading && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('loading_campaigns')}
          </div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('no_campaigns_saved')}
          </div>
        )}

        {!loading &&
          campaigns.map((c) => {
            const sent = c.results.filter((r) => r.status === 'sent').length
            const failed = c.results.filter((r) => r.status === 'failed').length
            const total = c.leadIds.length
            const statusInfo = getStatusLabels()[c.status] ??
              getStatusLabels()['draft'] ?? {
                label: c.status,
                className: '',
              }

            return (
              <div
                key={c.id}
                onClick={() => {
                  onSelectCampaign(c)
                }}
                className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate flex-1">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => this.handleEdit(e, c)}
                      className="text-xs text-primary hover:opacity-80"
                      title={t('edit_campaign')}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void this.handleCopy(e, c)}
                      className="text-xs text-primary hover:opacity-80"
                      title={t('copy_campaign')}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void this.handleDelete(e, c.id)}
                      className="text-xs text-destructive hover:opacity-80"
                      title={t('delete_campaign')}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{total} {t('contacts')}</span>
                  {sent > 0 && (
                    <span className="text-green-600 dark:text-green-400">{sent} {t('sent_label')}</span>
                  )}
                  {failed > 0 && (
                    <span className="text-red-600 dark:text-red-400">{failed} {t('failures_label')}</span>
                  )}
                  <span className="ml-auto">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            )
          })}
      </div>
    )
  }
}
