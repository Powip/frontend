import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/** Availability never creates settings or opens a catalogue. Errors keep navigation hidden. */
export async function getLiveAvailability(storeId: string, signal?: AbortSignal) {
  return (
    await axiosAuth.get<{ available: boolean }>(
      `${GATEWAY.ventas}/live/stores/${encodeURIComponent(storeId)}/availability`,
      { signal },
    )
  ).data;
}
