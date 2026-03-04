import { Component } from 'react'
import type { Campaign, CampaignResult } from '../../types/Campaign'
import { exportCampaignResults, downloadCSV } from '../../utils/csvExporter'
import CountdownBar from '../molecules/CountdownBar'
import { t } from '../../utils/i18n'

interface CampaignProgressProps {
  campaign: Campaign
  results: CampaignResult[]
  isRunning: boolean
  isPaused: boolean
  delayInfo: { totalMs: number; startedAt: number } | null
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onBack: () => void
}

export default class CampaignProgress extends Component<CampaignProgressProps> {
  private handleExport = () => {
    const { campaign } = this.props
    const csv = exportCampaignResults(campaign, [])
    const filename = `${campaign.name.replace(/\s+/g, '_')}_results.csv`
    downloadCSV(csv, filename)
  }

  override render() {
    const { campaign, results, isRunning, isPaused, delayInfo, onPause, onResume, onStop, onBack } =
      this.props

    const sent = results.filter((r) => r.status === 'sent').length
    const failed = results.filter((r) => r.status === 'failed').length
    const total = campaign.leadIds.length
    const pending = total - sent - failed
    const processed = sent + failed
    const progress = total > 0 ? (processed / total) * 100 : 0

    // KPIs
    const deliveryRate = processed > 0 ? (sent / processed) * 100 : 0
    const failureRate = processed > 0 ? (failed / processed) * 100 : 0

    // Velocity & ETA
    const sentResults = results.filter((r) => r.status === 'sent' && r.sentAt)
    let msgsPerMin = 0
    let etaMinutes = 0
    if (sentResults.length >= 2) {
      const times = sentResults
        .map((r) => new Date(r.sentAt!).getTime()) // eslint-disable-line @typescript-eslint/no-non-null-assertion
        .sort((a, b) => a - b)
      const elapsed = (times[times.length - 1]! - times[0]!) / 60_000 // eslint-disable-line @typescript-eslint/no-non-null-assertion
      msgsPerMin = elapsed > 0 ? sentResults.length / elapsed : 0
      etaMinutes = msgsPerMin > 0 ? pending / msgsPerMin : 0
    }

    // Elapsed time
    const elapsedMs = Date.now() - new Date(campaign.createdAt).getTime()
    const elapsedMin = Math.floor(elapsedMs / 60_000)
    const elapsedStr =
      elapsedMin >= 60
        ? `${String(Math.floor(elapsedMin / 60))}h ${String(elapsedMin % 60)}m`
        : `${String(elapsedMin)}m`

    // A/B stats
    const variantStats = campaign.variants.map((v) => {
      const vr = results.filter((r) => r.variantId === v.id)
      const vSent = vr.filter((r) => r.status === 'sent').length
      const vFailed = vr.filter((r) => r.status === 'failed').length
      const vProcessed = vSent + vFailed
      return {
        id: v.id,
        name: v.name,
        sent: vSent,
        failed: vFailed,
        total: vr.length,
        rate: vProcessed > 0 ? (vSent / vProcessed) * 100 : 0,
      }
    })

    const bestVariantId =
      variantStats.length > 0
        ? variantStats.reduce((best, v) => (v.rate > best.rate ? v : best)).id
        : null

    const maxSent = Math.max(...variantStats.map((v) => v.sent), 1)

    const isFinished = !isRunning && !isPaused

    return (
      <div className="flex flex-col gap-3">
        {/* Header with back button for non-running campaigns */}
        <div className="flex items-center gap-2">
          {!isRunning && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-primary hover:underline shrink-0"
            >
              {'← '}{t('back')}
            </button>
          )}
          <h2 className="text-sm font-medium truncate flex-1">{campaign.name}</h2>
          {isFinished && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/80 text-white">
              {t('summary')}
            </span>
          )}
          {isRunning && !isPaused && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-success/80 text-white animate-pulse">
              {t('status_running')}
            </span>
          )}
          {isPaused && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-warning/80 text-white">
              {t('status_paused')}
            </span>
          )}
        </div>

        {/* Pause reason banner */}
        {isPaused && campaign.pauseReason && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">
            <span className="text-base leading-none shrink-0 mt-0.5">&#x26A0;&#xFE0F;</span>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t('campaign_paused')}</span>
              <span className="text-[11px] leading-snug opacity-90">{campaign.pauseReason}</span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full h-5 bg-accent rounded relative">
          <div
            className={`h-5 rounded transition-all duration-300 ${
              isRunning ? 'progress-bar progress-bar-animated' : 'bg-success'
            }`}
            style={{ width: `${String(Math.min(progress, 100))}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-white drop-shadow">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Countdown Timer */}
        {isRunning && !isPaused && delayInfo && (
          <CountdownBar totalMs={delayInfo.totalMs} startedAt={delayInfo.startedAt} />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-secondary-lighter/20 rounded p-1.5">
            <div className="text-lg font-bold text-primary">{total}</div>
            <div className="text-[10px] text-muted-foreground">{t('total')}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded p-1.5">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{sent}</div>
            <div className="text-[10px] text-muted-foreground">{t('sent')}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 rounded p-1.5">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">{failed}</div>
            <div className="text-[10px] text-muted-foreground">{t('failures')}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-1.5">
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{pending}</div>
            <div className="text-[10px] text-muted-foreground">{t('pending')}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="border border-border rounded p-2.5">
          <h3 className="text-xs font-medium mb-2">{t('kpis')}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">{t('delivery')}</span>
              <span className="float-right font-medium text-green-600 dark:text-green-400">
                {deliveryRate.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('failure')}</span>
              <span className="float-right font-medium text-red-600 dark:text-red-400">
                {failureRate.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('speed')}</span>
              <span className="float-right font-medium">{msgsPerMin.toFixed(1)} msg/min</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('eta')}</span>
              <span className="float-right font-medium">
                {etaMinutes > 0
                  ? etaMinutes >= 60
                    ? `${String(Math.floor(etaMinutes / 60))}h ${String(Math.round(etaMinutes % 60))}m`
                    : `${String(Math.round(etaMinutes))}m`
                  : '—'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('elapsed_time')}</span>
              <span className="float-right font-medium">{elapsedStr}</span>
            </div>
          </div>
        </div>

        {/* A/B Variant Stats */}
        <div className="border border-border rounded p-2.5">
          <h3 className="text-xs font-medium mb-2">
            {campaign.variants.length > 1 ? t('ab_testing') : t('variant')}
          </h3>
          <div className="flex flex-col gap-2">
            {variantStats.map((v) => (
              <div key={v.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1">
                    {v.name}
                    {variantStats.length > 1 && v.id === bestVariantId && v.sent > 0 && (
                      <span className="text-[9px] px-1 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">
                        {t('best')}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {v.rate.toFixed(0)}% · {v.sent} {t('sent_abbr')} · {v.failed} {t('failure_abbr')}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-accent rounded overflow-hidden">
                  <div
                    className="h-full bg-primary rounded transition-all"
                    style={{
                      width: `${String((v.sent / maxSent) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="border border-border rounded max-h-40 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="p-1.5 text-left">{t('contact')}</th>
                <th className="p-1.5 text-left">{t('var_abbr')}</th>
                <th className="p-1.5 text-left">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {results
                .filter((r) => r.status !== 'pending')
                .slice(-20)
                .reverse()
                .map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-1.5 font-mono truncate max-w-[120px]">{r.contact}</td>
                    <td className="p-1.5">
                      {campaign.variants.find((v) => v.id === r.variantId)?.name ?? '—'}
                    </td>
                    <td className="p-1.5">
                      <span
                        className={`px-1 py-0.5 rounded font-medium ${
                          r.status === 'sent'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : r.status === 'failed'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                        }`}
                      >
                        {r.status === 'sent' ? t('ok') : r.status === 'failed' ? t('failed') : t('skipped')}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
          {isRunning && !isPaused && (
            <button
              type="button"
              onClick={onPause}
              className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded hover:opacity-90"
            >
              {t('pause')}
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:opacity-90"
            >
              {t('resume')}
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:opacity-90"
            >
              {t('stop')}
            </button>
          )}
          {!isRunning && !isPaused && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded hover:opacity-90"
            >
              {t('back')}
            </button>
          )}
          <button
            type="button"
            onClick={this.handleExport}
            disabled={sent + failed === 0}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 ml-auto"
          >
            {t('export_csv')}
          </button>
        </div>
      </div>
    )
  }
}
