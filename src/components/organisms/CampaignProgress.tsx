import { Component } from "react";
import type { Campaign, CampaignResult } from "../../types/Campaign";
import { exportCampaignResults, downloadCSV } from "../../utils/csvExporter";
import Button from "../atoms/Button";
import Box from "../molecules/Box";

interface CampaignProgressProps {
  campaign: Campaign;
  results: CampaignResult[];
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onBack: () => void;
}

export default class CampaignProgress extends Component<CampaignProgressProps> {
  private handleExport = () => {
    const { campaign } = this.props;
    const csv = exportCampaignResults(campaign, []);
    const filename = `${campaign.name.replace(/\s+/g, "_")}_results.csv`;
    downloadCSV(csv, filename);
  };

  override render() {
    const { campaign, results, isRunning, isPaused, onPause, onResume, onStop, onBack } =
      this.props;

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const pending = results.filter((r) => r.status === "pending").length;
    const total = results.length;
    const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

    // A/B stats
    const variantStats = campaign.variants.map((v) => {
      const varResults = results.filter((r) => r.variantId === v.id);
      return {
        name: v.name,
        total: varResults.length,
        sent: varResults.filter((r) => r.status === "sent").length,
        failed: varResults.filter((r) => r.status === "failed").length,
      };
    });

    return (
      <Box title={campaign.name} className="max-w-3xl">
        <div className="p-4 flex flex-col gap-4">
          {/* Progress Bar */}
          <div className="w-full h-6 bg-gray-300 dark:bg-gray-600 rounded relative">
            <div
              className={`h-6 rounded transition-all duration-300 ${
                isRunning
                  ? "bg-blue-500 progress-bar-animated"
                  : "bg-green-500"
              }`}
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-white drop-shadow">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {total}
              </div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {sent}
              </div>
              <div className="text-xs text-slate-500">Enviadas</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded p-2">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {failed}
              </div>
              <div className="text-xs text-slate-500">Falhas</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-2">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {pending}
              </div>
              <div className="text-xs text-slate-500">Pendentes</div>
            </div>
          </div>

          {/* A/B Variant Stats */}
          {campaign.variants.length > 1 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded p-3">
              <h3 className="text-sm font-medium mb-2">A/B Testing</h3>
              <div className="grid gap-2">
                {variantStats.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="text-slate-500">
                      {v.sent}/{v.total} enviadas
                      {v.failed > 0 && (
                        <span className="text-red-500 ml-1">
                          ({v.failed} falhas)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Messages */}
          <div className="border border-slate-200 dark:border-slate-700 rounded max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Contato</th>
                  <th className="p-2 text-left">Variante</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .filter((r) => r.status !== "pending")
                  .slice(-20)
                  .reverse()
                  .map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="p-2 font-mono">{r.contact}</td>
                      <td className="p-2">
                        {campaign.variants.find((v) => v.id === r.variantId)
                          ?.name ?? "—"}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            r.status === "sent"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : r.status === "failed"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                          }`}
                        >
                          {r.status === "sent"
                            ? "Enviada"
                            : r.status === "failed"
                              ? "Falha"
                              : "Pulada"}
                        </span>
                        {r.error && (
                          <span className="ml-1 text-red-500">{r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Controls */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            {isRunning && !isPaused && (
              <Button variant="warning" onClick={onPause}>
                Pausar
              </Button>
            )}
            {isPaused && (
              <Button variant="success" onClick={onResume}>
                Retomar
              </Button>
            )}
            {isRunning && (
              <Button variant="danger" onClick={onStop}>
                Parar
              </Button>
            )}
            {!isRunning && (
              <Button variant="secondary" onClick={onBack}>
                Voltar
              </Button>
            )}
            <Button
              variant="info"
              onClick={this.handleExport}
              disabled={sent + failed === 0}
            >
              Exportar CSV
            </Button>
          </div>
        </div>
      </Box>
    );
  }
}
