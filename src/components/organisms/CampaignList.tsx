import { Component } from 'react'
import type { Campaign } from '../../types/Campaign'
import campaignStorage from '../../utils/CampaignStorage'
import Button from '../atoms/Button'

interface CampaignListProps {
  onNewCampaign: () => void
  onSelectCampaign: (campaign: Campaign) => void
}

interface CampaignListState {
  campaigns: Campaign[]
  loading: boolean
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  running: {
    label: 'Em execução',
    className: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  },
  paused: {
    label: 'Pausada',
    className: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  },
  completed: {
    label: 'Concluída',
    className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  },
  preview: { label: 'Preview', className: 'bg-muted text-muted-foreground' },
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
    // Sort by creation date, newest first
    campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    this.setState({ campaigns, loading: false })
  }

  private handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await campaignStorage.deleteCampaign(id)
    await this.load()
  }

  override render() {
    const { onNewCampaign, onSelectCampaign } = this.props
    const { campaigns, loading } = this.state

    return (
      <div className="flex flex-col gap-3 p-3">
        <Button variant="primary" onClick={onNewCampaign} className="text-sm w-full">
          + Nova Campanha
        </Button>

        {loading && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Carregando campanhas...
          </div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma campanha salva. Crie sua primeira campanha!
          </div>
        )}

        {!loading &&
          campaigns.map((c) => {
            const sent = c.results.filter((r) => r.status === 'sent').length
            const failed = c.results.filter((r) => r.status === 'failed').length
            const total = c.leadIds.length
            const statusInfo = STATUS_LABELS[c.status] ??
              STATUS_LABELS['draft'] ?? {
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
                      onClick={(e) => void this.handleDelete(e, c.id)}
                      className="text-xs text-destructive hover:opacity-80"
                      title="Excluir campanha"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{total} contatos</span>
                  {sent > 0 && (
                    <span className="text-green-600 dark:text-green-400">{sent} enviadas</span>
                  )}
                  {failed > 0 && (
                    <span className="text-red-600 dark:text-red-400">{failed} falhas</span>
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
