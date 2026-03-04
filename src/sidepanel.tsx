import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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

const messageManager = new AsyncChromeMessageManager('sidepanel')

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
        reject(new Error('Timeout: WhatsApp não respondeu (60s)'))
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
  }

  override componentWillUnmount() {
    clearInterval(this.checkInterval)
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
    campaignManager.resume()
    this.setState({ isPaused: false })
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
      activeTab: 'campaigns',
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
    } = this.state

    const hasActiveCampaign = isRunning || (campaign && results.length > 0)

    const tabs = [
      { key: 'progress', label: 'Progresso', badge: !!hasActiveCampaign },
      { key: 'campaigns', label: 'Campanhas' },
      { key: 'contacts', label: 'Contatos' },
      { key: 'logs', label: 'Logs' },
    ]

    return (
      <div className="flex flex-col h-screen">
        {/* Tab bar */}
        <ScrollableTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(key) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            this.setState({ activeTab: key as Tab })
          }}
        />

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* WhatsApp not connected feedback */}
          {!whatsappConnected && !checkingWhatsApp ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16 p-3">
              <div className="text-4xl opacity-40">📱</div>
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp Web não encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Abra o WhatsApp Web em uma aba para usar a extensão
                </p>
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
                Abrir WhatsApp Web
              </button>
            </div>
          ) : checkingWhatsApp ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">Verificando...</p>
            </div>
          ) : (
            <>
              {/* WPP Status Banner */}
              {wppStatus && !wppStatus.ready && (
                <div className="mx-3 mt-2 flex items-start gap-2 p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
                  <span className="text-base leading-none shrink-0 mt-0.5">&#x1F6A8;</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">WPP não inicializou</span>
                    <span className="text-[10px] leading-snug opacity-90">
                      {wppStatus.error ??
                        (!wppStatus.injected
                          ? 'injectLoader() falhou. Recarregue o WhatsApp Web.'
                          : !wppStatus.authenticated
                            ? 'WhatsApp não autenticado. Faça login no WhatsApp Web.'
                            : 'Aguardando inicialização... se persistir, recarregue a página.')}
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
                  <span className="text-[11px]">
                    WhatsApp não autenticado. Faça login no WhatsApp Web.
                  </span>
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
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                    <div className="text-3xl opacity-30">📊</div>
                    <p className="text-sm text-muted-foreground">Nenhuma campanha em execução</p>
                    <button
                      type="button"
                      onClick={() => {
                        this.setState({ activeTab: 'campaigns' })
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Ir para Campanhas
                    </button>
                  </div>
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
                        ← Voltar para lista
                      </button>
                    </div>
                    <UnifiedEditor onCampaignStart={this.handleCampaignStart} />
                  </div>
                ) : (
                  <CampaignList
                    onNewCampaign={() => {
                      this.setState({ editorMode: true })
                    }}
                    onSelectCampaign={(c) => {
                      this.setState({
                        campaign: c,
                        results: c.results,
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

createRoot(document.getElementById('root') ?? document.body).render(<SidePanel />)
