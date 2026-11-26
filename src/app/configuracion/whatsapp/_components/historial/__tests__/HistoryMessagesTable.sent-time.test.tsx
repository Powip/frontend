import { render, screen } from "@testing-library/react";
import type { WhatsAppHistoryMessage } from "@/features/whatsapp/models/history.model";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { deliveredWithClickMessage } from "@/mocks/whatsapp/whatsapp-history.fixtures";
import { HistoryMessagesTable } from "../HistoryMessagesTable";

function renderRow(message: WhatsAppHistoryMessage) {
  return render(
    <HistoryMessagesTable
      page={{ items: [message], page: 1, pageSize: 20, total: 1, hasMore: false }}
      resendBlockedReason={null}
      onOpenOrder={jest.fn()}
      paginationBlockedReason="Sin más páginas"
    />,
  );
}

describe("Historial: hora de envío", () => {
  it("la fila muestra cuándo se envió y, aparte, desde cuándo esperó en cola", () => {
    const queuedAt = new Date("2026-10-08T13:30:00.000Z");
    const sentAt = new Date("2026-10-08T14:02:00.000Z");
    renderRow({
      ...deliveredWithClickMessage,
      createdAt: queuedAt,
      timeline: { ...deliveredWithClickMessage.timeline, queuedAt, sentAt },
    });
    expect(screen.getAllByText(formatLimaDateTime(sentAt)).length).toBeGreaterThan(0);
    expect(screen.getByText(`En cola desde ${formatLimaDateTime(queuedAt)}`)).toBeInTheDocument();
  });

  it("si salió enseguida no repite la hora de cola", () => {
    const queuedAt = new Date("2026-10-08T14:01:40.000Z");
    const sentAt = new Date("2026-10-08T14:02:00.000Z");
    renderRow({
      ...deliveredWithClickMessage,
      createdAt: queuedAt,
      timeline: { ...deliveredWithClickMessage.timeline, queuedAt, sentAt },
    });
    expect(screen.queryByText(/En cola desde/)).not.toBeInTheDocument();
  });
});
