import { Component } from "react";
import { createRoot } from "react-dom/client";
import "index.css";
import LogTable from "components/organisms/LogTable";
import MessageButtonsForm from "components/organisms/MessageButtonsForm";
import MessageForm from "components/organisms/MessageForm";
import CSVImport from "components/organisms/CSVImport";
import CampaignEditor from "components/organisms/CampaignEditor";
import CampaignProgress from "components/organisms/CampaignProgress";
import type { Lead } from "types/Lead";
import type { Campaign, CampaignResult } from "types/Campaign";
import campaignManager from "utils/CampaignManager";
import { ChromeMessageTypes } from "types/ChromeMessageTypes";
import AsyncChromeMessageManager from "utils/AsyncChromeMessageManager";

const OptionsMessageManager = new AsyncChromeMessageManager("popup");

type OptionsTab = "message" | "campaign" | "logs";

interface OptionsState {
  activeTab: OptionsTab;
  leads: Lead[];
  campaign: Campaign | null;
  results: CampaignResult[];
  isRunning: boolean;
  isPaused: boolean;
  step: "import" | "editor" | "progress" | "preview";
}

class Options extends Component<unknown, OptionsState> {
  private pollInterval = 0;

  constructor(props: unknown) {
    super(props);
    this.state = {
      activeTab: "message",
      leads: [],
      campaign: null,
      results: [],
      isRunning: false,
      isPaused: false,
      step: "import",
    };
  }

  override componentDidMount() {
    const body = document.querySelector("body");
    if (!body) return;
    body.classList.add("bg-gray-100");
    body.classList.add("dark:bg-gray-900");
    body.style.minWidth = "48rem";

    // Check URL hash for direct tab navigation
    if (window.location.hash === "#campaign") {
      this.setState({ activeTab: "campaign" });
    }
  }

  override componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private handleLeadsImported = (leads: Lead[]) => {
    this.setState({ leads, step: "editor" });
  };

  private handleStartCampaign = (campaign: Campaign) => {
    this.setState({ campaign, step: "progress", isRunning: true, isPaused: false });
    const { leads } = this.state;
    campaignManager.onStatusChange((updated: Campaign) => {
      this.setState({
        campaign: updated,
        results: updated.results,
        isRunning: updated.status === "running",
        isPaused: updated.status === "paused",
      });
    });
    campaignManager
      .start(campaign, leads)
      .then(() => {
        this.setState({ isRunning: false });
      })
      .catch(() => {
        this.setState({ isRunning: false });
      });
    this.setState({ results: campaign.results });
  };

  private handlePreview = (results: CampaignResult[]) => {
    this.setState({ results, step: "preview" });
  };

  private handlePause = () => {
    void OptionsMessageManager.sendMessage(
      ChromeMessageTypes.PAUSE_QUEUE,
      undefined,
    );
    this.setState({ isPaused: true });
  };

  private handleResume = () => {
    void OptionsMessageManager.sendMessage(
      ChromeMessageTypes.RESUME_QUEUE,
      undefined,
    );
    this.setState({ isPaused: false });
  };

  private handleStop = () => {
    void OptionsMessageManager.sendMessage(
      ChromeMessageTypes.STOP_QUEUE,
      undefined,
    );
    this.setState({ isRunning: false });
  };

  override render() {
    const { activeTab, leads, campaign, results, isRunning, isPaused, step } =
      this.state;

    return (
      <div className="max-w-4xl mx-auto py-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-slate-300 dark:border-slate-700">
          {(
            [
              ["message", "Mensagem"],
              ["campaign", "Campanha"],
              ["logs", "Logs"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => this.setState({ activeTab: key })}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Message Tab (original) */}
        {activeTab === "message" && (
          <>
            <MessageForm className="my-10" />
            <MessageButtonsForm className="my-10" />
          </>
        )}

        {/* Campaign Tab */}
        {activeTab === "campaign" && (
          <div className="flex flex-col gap-6">
            {step === "import" && (
              <CSVImport onImport={this.handleLeadsImported} />
            )}

            {step === "editor" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {leads.length} leads importados
                  </span>
                  <button
                    type="button"
                    onClick={() => this.setState({ step: "import" })}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reimportar CSV
                  </button>
                </div>
                <CampaignEditor
                  leads={leads}
                  onStart={this.handleStartCampaign}
                  onPreview={this.handlePreview}
                />
              </>
            )}

            {step === "progress" && campaign && (
              <CampaignProgress
                campaign={campaign}
                results={results}
                isRunning={isRunning}
                isPaused={isPaused}
                onPause={this.handlePause}
                onResume={this.handleResume}
                onStop={this.handleStop}
                onBack={() => this.setState({ step: "editor" })}
              />
            )}

            {step === "preview" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">
                    Preview (Dry Run) — {results.length} mensagens
                  </h2>
                  <button
                    type="button"
                    onClick={() => this.setState({ step: "editor" })}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Voltar ao editor
                  </button>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded max-h-96 overflow-y-auto">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-500">
                          {r.contact}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded">
                          {r.variantId}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {r.generatedMessage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && <LogTable className="my-10" />}
      </div>
    );
  }
}

createRoot(document.getElementById("root") ?? document.body).render(
  <Options />,
);
