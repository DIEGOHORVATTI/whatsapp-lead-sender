import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { storageMock } from "../../__test__/chrome-mock";
import LogTable from "./LogTable";

describe("LogTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.local.get.mockImplementation((cb: (data: { logs?: unknown[] }) => void) => {
      cb({ logs: [] });
    });
  });

  it("should render empty state when no logs", () => {
    render(<LogTable />);
    expect(screen.getByText("Nenhum evento registrado")).toBeInTheDocument();
    expect(screen.getByText("0 eventos")).toBeInTheDocument();
  });

  it("should render version number", () => {
    render(<LogTable />);
    expect(screen.getByText("v0.0.0-test")).toBeInTheDocument();
  });

  it("should render logs when present", () => {
    storageMock.local.get.mockImplementation((cb: (data: { logs?: unknown[] }) => void) => {
      cb({
        logs: [
          { level: 3, message: "Mensagem enviada!", contact: "5511999887766", date: "03/03/2026" },
          { level: 1, message: "Falha: Timeout", contact: "5511888776655", date: "03/03/2026" },
        ],
      });
    });

    render(<LogTable />);
    expect(screen.getByText("2 eventos")).toBeInTheDocument();
    expect(screen.getByText("Mensagem enviada!")).toBeInTheDocument();
    expect(screen.getByText("Falha: Timeout")).toBeInTheDocument();
  });

  it("should show clear button when logs exist", () => {
    storageMock.local.get.mockImplementation((cb: (data: { logs?: unknown[] }) => void) => {
      cb({ logs: [{ level: 2, message: "test", contact: "", date: "" }] });
    });

    render(<LogTable />);
    expect(screen.getByText("Limpar")).toBeInTheDocument();
  });

  it("should clear logs on button click", async () => {
    storageMock.local.get.mockImplementation((cb: (data: { logs?: unknown[] }) => void) => {
      cb({ logs: [{ level: 2, message: "test", contact: "", date: "" }] });
    });

    render(<LogTable />);
    await userEvent.click(screen.getByText("Limpar"));

    expect(storageMock.local.set).toHaveBeenCalledWith({ logs: [] });
    expect(screen.getByText("0 eventos")).toBeInTheDocument();
  });

  it("should not show clear button when no logs", () => {
    render(<LogTable />);
    expect(screen.queryByText("Limpar")).not.toBeInTheDocument();
  });
});
