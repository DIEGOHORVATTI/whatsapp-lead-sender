import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LanguageSelector from 'components/molecules/LanguageSelector'
import ScrollableTabBar from 'components/molecules/ScrollableTabBar'
import CampaignList from 'components/organisms/CampaignList'
import CampaignProgress from 'components/organisms/CampaignProgress'
import ContactsTab from 'components/organisms/ContactsTab'
import LogTable from 'components/organisms/LogTable'
import UnifiedEditor from 'components/organisms/UnifiedEditor'
import type { Campaign } from 'types/Campaign'
import { ChromeMessageTypes } from 'types/ChromeMessageTypes'
import type { Lead } from 'types/Lead'
import { normalizePhone } from 'types/Lead'
import AsyncChromeMessageManager from 'utils/AsyncChromeMessageManager'
import campaignManager from 'utils/CampaignManager'
import campaignStorage from 'utils/CampaignStorage'
import { t, I18nProvider } from 'utils/i18n'

const messageManager = new AsyncChromeMessageManager('sidepanel')

// --- Progress Overview (list of campaigns with results) ---

interface ProgressOverviewProps {
  onSelectCampaign: (campaign: Campaign) => void
  onNewCampaign: () => void
  activeCampaign?: Campaign | null
}

interface ProgressOverviewState {
  campaigns: Campaign[]
  loading: boolean
}

class ProgressOverview extends Component<ProgressOverviewProps, ProgressOverviewState> {
  constructor(props: ProgressOverviewProps) {
    super(props)
    this.state = { campaigns: [], loading: true }
  }

  override componentDidMount() {
    void this.load()
  }

  private async load() {
    const all = await campaignStorage.listCampaigns()
    // Merge live state from active campaign
    const active = this.props.activeCampaign
    const merged = active ? all.map((c) => (c.id === active.id ? active : c)) : all
    const campaigns = merged
      .filter((c) => c.results.length > 0 || c.status === 'running' || c.status === 'paused')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    this.setState({ campaigns, loading: false })
  }

  override render() {
    const { campaigns, loading } = this.state

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs text-muted-foreground">{t('loading')}</p>
        </div>
      )
    }

    if (campaigns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
          <div className="text-3xl opacity-30">📊</div>
          <p className="text-sm text-muted-foreground">{t('no_campaigns_progress')}</p>
          <button
            type="button"
            onClick={this.props.onNewCampaign}
            className="text-xs text-primary hover:underline"
          >
            {t('create_campaign')}
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('campaigns_with_progress')}
        </div>
        {campaigns.map((c) => {
          const sent = c.results.filter((r) => r.status === 'sent').length
          const failed = c.results.filter((r) => r.status === 'failed').length
          const total = c.leadIds.length
          const progress = total > 0 ? ((sent + failed) / total) * 100 : 0
          const statusLabel =
            c.status === 'completed'
              ? t('status_completed')
              : c.status === 'paused'
                ? t('status_paused')
                : c.status === 'running'
                  ? t('status_running')
                  : t('status_draft')
          const statusClass =
            c.status === 'completed'
              ? 'bg-primary/15 text-primary'
              : c.status === 'paused'
                ? 'bg-warning/15 text-warning'
                : c.status === 'running'
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground'

          return (
            <div
              key={c.id}
              onClick={() => {
                this.props.onSelectCampaign(c)
              }}
              className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate flex-1">{c.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="w-full h-1.5 bg-accent rounded overflow-hidden mb-1.5">
                <div
                  className="h-full bg-primary rounded transition-all"
                  style={{ width: `${String(Math.min(progress, 100))}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{Math.round(progress)}%</span>
                <span className="text-success">
                  {sent} {t('sent_abbr')}
                </span>
                {failed > 0 && (
                  <span className="text-destructive">
                    {failed} {t('failure_abbr')}
                  </span>
                )}
                <span className="ml-auto">
                  {total} {t('contacts')}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}

// Wire up the send function so CampaignManager can send messages via content script
campaignManager.setSendFunction(async (contact: string, message: string) => {
  console.log('[WTF] sendFn called:', contact, message.slice(0, 50) + '...')

  // Race between the message manager and a 60s timeout
  const result = await Promise.race([
    messageManager.sendMessage(ChromeMessageTypes.SEND_MESSAGE, {
      contact,
      message,
      buttons: [],
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(t('timeout_error')))
      }, 60_000)
    }),
  ])

  console.log('[WTF] sendFn result:', result)
  return result
})

type Tab = 'progress' | 'campaigns' | 'contacts' | 'logs'

interface WppStatus {
  ready: boolean
  authenticated: boolean
  injected: boolean
  error?: string
}

interface SidePanelState {
  activeTab: Tab
  campaign: Campaign | null
  results: Campaign['results']
  isRunning: boolean
  isPaused: boolean
  whatsappConnected: boolean
  checkingWhatsApp: boolean
  wppStatus: WppStatus | null
  delayInfo: { totalMs: number; startedAt: number } | null
  editorMode: boolean
  editingCampaign: Campaign | null
}

class SidePanel extends Component<unknown, SidePanelState> {
  private checkInterval = 0

  constructor(props: unknown) {
    super(props)
    this.state = {
      activeTab: 'campaigns',
      campaign: null,
      results: [],
      isRunning: false,
      isPaused: false,
      whatsappConnected: false,
      checkingWhatsApp: true,
      wppStatus: null,
      delayInfo: null,
      editorMode: false,
      editingCampaign: null,
    }
  }

  override componentDidMount() {
    void this.checkWhatsApp()
    this.checkInterval = window.setInterval(() => {
      void this.checkWhatsApp()
      void this.checkWppStatus()
    }, 3000)

    // Listen for incoming messages (responses from contacts)
    chrome.runtime.onMessage.addListener((msg: { type?: string; payload?: { from?: string } }) => {
      if (msg.type === ChromeMessageTypes.INCOMING_MESSAGE && msg.payload?.from) {
        void this.handleIncomingMessage(msg.payload.from)
      }
    })

    // On sidebar close, pause any running campaign so it can be resumed later
    window.addEventListener('beforeunload', () => {
      if (this.state.isRunning) {
        campaignManager.stop()
      }
    })

    // Auto-detect paused/running campaigns from storage and show progress
    void this.detectActiveCampaign()
  }

  override componentWillUnmount() {
    clearInterval(this.checkInterval)
  }

  private async detectActiveCampaign() {
    const all = await campaignStorage.listCampaigns()
    const active = all.find((c) => c.status === 'running' || c.status === 'paused')
    if (active) {
      this.setState({
        campaign: active,
        results: active.results,
        isPaused: true,
        isRunning: false,
        activeTab: 'progress',
      })
    }
  }

  private async handleIncomingMessage(fromPhone: string) {
    try {
      const normalized = normalizePhone(fromPhone)
      const lead = await campaignStorage.getLeadByPhone(normalized)
      if (lead) {
        await campaignStorage.updateLeadMetaResponse(lead.id)
      }
    } catch {
      // ignore
    }
  }

  private async checkWppStatus() {
    try {
      const status = await Promise.race([
        messageManager.sendMessage(ChromeMessageTypes.WPP_STATUS, undefined),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null)
          }, 5000)
        ),
      ])
      if (status) this.setState({ wppStatus: status })
    } catch {
      // ignore
    }
  }

  private async checkWhatsApp() {
    try {
      const tabs = await chrome.tabs.query({
        url: 'https://web.whatsapp.com/*',
      })
      this.setState({
        whatsappConnected: tabs.length > 0,
        checkingWhatsApp: false,
      })
    } catch {
      this.setState({ whatsappConnected: false, checkingWhatsApp: false })
    }
  }

  private handleCampaignStart = (campaign: Campaign, leads: Lead[]) => {
    this.setState({
      campaign,
      isRunning: true,
      isPaused: false,
      activeTab: 'progress',
      editorMode: false,
      delayInfo: null,
    })

    campaignManager.onStatusChange((updated: Campaign) => {
      this.setState({
        campaign: updated,
        results: updated.results,
        isRunning: updated.status === 'running',
        isPaused: updated.status === 'paused',
      })
    })

    campaignManager.onDelayChange((info) => {
      this.setState({ delayInfo: info })
    })

    campaignManager
      .start(campaign, leads)
      .then(() => {
        this.setState({ isRunning: false, delayInfo: null })
      })
      .catch(() => {
        this.setState({ isRunning: false, delayInfo: null })
      })
  }

  private handlePause = () => {
    campaignManager.pause()
    this.setState({ isPaused: true })
  }

  private handleResume = () => {
    const { campaign, isRunning } = this.state
    if (!campaign) return

    // If the campaign manager is actively running (just paused mid-execution), simply resume
    if (isRunning) {
      campaignManager.resume()
      this.setState({ isPaused: false })
      return
    }

    // Otherwise, re-start the campaign from where it left off (e.g. opened from list)
    void this.restartCampaign(campaign)
  }

  private async restartCampaign(campaign: Campaign) {
    const leads = await campaignStorage.getLeads(campaign.leadIds)
    campaign.status = 'running'
    campaign.pauseReason = undefined
    this.handleCampaignStart(campaign, leads)
  }

  private handleStop = () => {
    campaignManager.stop()
    this.setState({ isRunning: false, delayInfo: null })
  }

  private handleBack = () => {
    this.setState({
      campaign: null,
      results: [],
      isRunning: false,
      delayInfo: null,
    })
  }

  override render() {
    const {
      activeTab,
      campaign,
      results,
      isRunning,
      isPaused,
      whatsappConnected,
      checkingWhatsApp,
      wppStatus,
      delayInfo,
      editorMode,
      editingCampaign,
    } = this.state

    const hasActiveCampaign = isRunning || (campaign && results.length > 0)

    const tabs = [
      { key: 'progress', label: t('tab_progress'), badge: isRunning },
      { key: 'campaigns', label: t('tab_campaigns') },
      { key: 'contacts', label: t('tab_contacts') },
      { key: 'logs', label: t('tab_logs') },
    ]

    return (
      <div className="flex flex-col h-screen">
        {/* Tab bar + Language selector */}
        <div className="flex items-center">
          <div className="flex-1">
            <ScrollableTabBar
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(key) => {
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                this.setState({ activeTab: key as Tab })
              }}
            />
          </div>
          <div className="px-2 shrink-0">
            <LanguageSelector />
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* WhatsApp not connected feedback */}
          {!whatsappConnected && !checkingWhatsApp ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16 p-3">
              <div className="text-4xl opacity-40">📱</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t('whatsapp_not_found')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('whatsapp_open_tab')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void chrome.tabs.create({
                    url: 'https://web.whatsapp.com',
                  })
                }}
                className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                {t('whatsapp_open')}
              </button>
            </div>
          ) : checkingWhatsApp ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">{t('checking')}</p>
            </div>
          ) : (
            <>
              {/* WPP Status Banner */}
              {wppStatus && !wppStatus.ready && (
                <div className="mx-3 mt-2 flex items-start gap-2 p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
                  <span className="text-base leading-none shrink-0 mt-0.5">&#x1F6A8;</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">{t('wpp_not_initialized')}</span>
                    <span className="text-[10px] leading-snug opacity-90">
                      {wppStatus.error ??
                        (!wppStatus.injected
                          ? t('wpp_inject_failed')
                          : !wppStatus.authenticated
                            ? t('wpp_not_authenticated')
                            : t('wpp_waiting'))}
                    </span>
                    <span className="text-[9px] opacity-60 font-mono">
                      injected: {String(wppStatus.injected)} | ready: {String(wppStatus.ready)} |
                      auth: {String(wppStatus.authenticated)}
                    </span>
                  </div>
                </div>
              )}

              {wppStatus?.ready && !wppStatus.authenticated && (
                <div className="mx-3 mt-2 flex items-start gap-2 p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">
                  <span className="text-sm leading-none shrink-0">&#x26A0;&#xFE0F;</span>
                  <span className="text-[11px]">{t('wpp_not_authenticated')}</span>
                </div>
              )}

              {activeTab === 'progress' &&
                (hasActiveCampaign && campaign ? (
                  <div className="p-3">
                    <CampaignProgress
                      campaign={campaign}
                      results={results}
                      isRunning={isRunning}
                      isPaused={isPaused}
                      delayInfo={delayInfo}
                      onPause={this.handlePause}
                      onResume={this.handleResume}
                      onStop={this.handleStop}
                      onBack={this.handleBack}
                    />
                  </div>
                ) : (
                  <ProgressOverview
                    activeCampaign={campaign}
                    onSelectCampaign={(c) => {
                      this.setState({
                        campaign: c,
                        results: c.results,
                        isPaused: c.status === 'paused',
                        isRunning: c.status === 'running',
                      })
                    }}
                    onNewCampaign={() => {
                      this.setState({
                        activeTab: 'campaigns',
                        editorMode: true,
                        editingCampaign: null,
                      })
                    }}
                  />
                ))}

              {activeTab === 'campaigns' &&
                (editorMode ? (
                  <div className="p-3">
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          this.setState({ editorMode: false })
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('back_to_list')}
                      </button>
                    </div>
                    <UnifiedEditor
                      key={editingCampaign?.id ?? 'new'}
                      onCampaignStart={this.handleCampaignStart}
                      onCampaignSave={() => {
                        this.setState({ editorMode: false, editingCampaign: null })
                      }}
                      initialCampaign={editingCampaign}
                    />
                  </div>
                ) : (
                  <CampaignList
                    onNewCampaign={() => {
                      this.setState({ editorMode: true, editingCampaign: null })
                    }}
                    onEditCampaign={(c) => {
                      this.setState({ editorMode: true, editingCampaign: c })
                    }}
                    onDeleteCampaign={(id) => {
                      if (campaign?.id === id) {
                        campaignManager.stop()
                        this.setState({
                          campaign: null,
                          results: [],
                          isRunning: false,
                          isPaused: false,
                          delayInfo: null,
                        })
                      }
                    }}
                    onSelectCampaign={(c) => {
                      this.setState({
                        campaign: c,
                        results: c.results,
                        isPaused: c.status === 'paused',
                        isRunning: c.status === 'running',
                        activeTab: 'progress',
                      })
                    }}
                  />
                ))}

              {activeTab === 'contacts' && <ContactsTab />}

              {activeTab === 'logs' && (
                <div className="p-3">
                  <LogTable />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root') ?? document.body).render(
  <I18nProvider>
    <SidePanel />
  </I18nProvider>
)
