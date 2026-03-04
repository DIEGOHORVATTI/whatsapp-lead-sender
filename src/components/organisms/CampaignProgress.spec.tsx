import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import type { Campaign, CampaignResult } from '../../types/Campaign'
import { DEFAULT_TIMING, DEFAULT_BATCH } from '../../types/Campaign'
import CampaignProgress from './CampaignProgress'

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'test-1',
    name: 'Test Campaign',
    leadIds: ['l1', 'l2', 'l3'],
    variants: [{ id: 'v1', name: 'Default', template: 'Hi {decisor}', useAI: false }],
    timing: { ...DEFAULT_TIMING },
    batch: { ...DEFAULT_BATCH },
    results: [],
    status: 'running',
    dailySentCount: 0,
    dailyResetDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeResult(overrides: Partial<CampaignResult> = {}): CampaignResult {
  return {
    leadId: 'l1',
    variantId: 'v1',
    contact: '5511999887766',
    status: 'sent',
    sentAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('CampaignProgress', () => {
  const defaultProps = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onBack: vi.fn(),
    delayInfo: null,
  }

  it('should render campaign name', () => {
    render(
      <CampaignProgress
        campaign={makeCampaign()}
        results={[]}
        isRunning={true}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Test Campaign')).toBeInTheDocument()
  })

  it('should show correct stats', () => {
    const results = [
      makeResult({ leadId: 'l1', status: 'sent' }),
      makeResult({ leadId: 'l2', status: 'failed' }),
    ]
    render(
      <CampaignProgress
        campaign={makeCampaign({ results })}
        results={results}
        isRunning={true}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument() // total
    const ones = screen.getAllByText('1')
    expect(ones).toHaveLength(3) // sent=1, failed=1, pending=1
  })

  it('should show pause reason banner when paused', () => {
    const campaign = makeCampaign({
      status: 'paused',
      pauseReason: 'Fora do horário permitido (8h às 20h).',
    })
    render(
      <CampaignProgress
        campaign={campaign}
        results={[]}
        isRunning={false}
        isPaused={true}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Campanha pausada')).toBeInTheDocument()
    expect(screen.getByText(/Fora do horário permitido/)).toBeInTheDocument()
  })

  it('should not show pause banner when running', () => {
    render(
      <CampaignProgress
        campaign={makeCampaign()}
        results={[]}
        isRunning={true}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.queryByText('Campanha pausada')).not.toBeInTheDocument()
  })

  it('should show Pausar button when running', () => {
    render(
      <CampaignProgress
        campaign={makeCampaign()}
        results={[]}
        isRunning={true}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Pausar')).toBeInTheDocument()
    expect(screen.getByText('Parar')).toBeInTheDocument()
  })

  it('should show Retomar button when paused', () => {
    render(
      <CampaignProgress
        campaign={makeCampaign({ status: 'paused' })}
        results={[]}
        isRunning={true}
        isPaused={true}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Retomar')).toBeInTheDocument()
  })

  it('should show Voltar and disable export when not running with no results', () => {
    render(
      <CampaignProgress
        campaign={makeCampaign({ status: 'completed' })}
        results={[]}
        isRunning={false}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Voltar')).toBeInTheDocument()
    expect(screen.getByText('Exportar CSV')).toBeDisabled()
  })

  it('should enable export when there are results', () => {
    const results = [makeResult()]
    render(
      <CampaignProgress
        campaign={makeCampaign({ results })}
        results={results}
        isRunning={false}
        isPaused={false}
        {...defaultProps}
      />
    )
    expect(screen.getByText('Exportar CSV')).not.toBeDisabled()
  })
})
