export type LivePollingRefreshOptions = {
  quiet?: boolean;
  /** Discard an older read and obtain a fresh response after it settles. */
  supersede?: boolean;
};

export type LivePollingController = {
  refresh: (options?: LivePollingRefreshOptions) => Promise<boolean>;
  /** Pauses automatic reads. Explicit refreshes still reconcile completed actions. */
  setPaused: (paused: boolean, options?: { refreshOnResume?: boolean }) => void;
  dispose: () => void;
};

type LivePollingOptions<T> = {
  load: (signal: AbortSignal) => Promise<T>;
  onData: (value: T) => void;
  onError?: (error: unknown, quiet: boolean) => void;
  onLoading?: (loading: boolean, quiet: boolean) => void;
  intervalMs: number | (() => number);
};

/** One scoped reader: no shared cache, overlapping reads, or hidden-page work. */
export function createLivePolling<T>(options: LivePollingOptions<T>): LivePollingController {
  const page = typeof document === "undefined" ? null : document;
  const browser = typeof window === "undefined" ? null : window;
  let disposed = false;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: {
    controller: AbortController;
    promise: Promise<boolean>;
  } | null = null;
  let queued: {
    quiet: boolean;
    automatic: boolean;
    promise: Promise<boolean>;
    resolve: (applied: boolean) => void;
  } | null = null;

  const visible = () => page?.visibilityState !== "hidden";
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const clearQueue = () => {
    queued?.resolve(false);
    queued = null;
  };
  function schedule() {
    clearTimer();
    if (disposed || paused || !visible() || flight) return;
    const interval =
      typeof options.intervalMs === "function" ? options.intervalMs() : options.intervalMs;
    timer = setTimeout(
      () => {
        timer = undefined;
        void request({ quiet: true }, true);
      },
      Number.isFinite(interval) && interval > 0 ? interval : 5000,
    );
  }
  function request(
    { quiet = true, supersede = false }: LivePollingRefreshOptions = {},
    automatic = false,
  ): Promise<boolean> {
    if (disposed || !visible() || (automatic && paused)) return Promise.resolve(false);
    clearTimer();
    if (flight) {
      if (!supersede && !flight.controller.signal.aborted) return flight.promise;
      flight.controller.abort();
      if (!queued) {
        let resolve!: (applied: boolean) => void;
        const promise = new Promise<boolean>((done) => {
          resolve = done;
        });
        queued = { quiet, automatic, promise, resolve };
      } else {
        queued.quiet = queued.quiet && quiet;
        queued.automatic = queued.automatic && automatic;
      }
      return queued.promise;
    }
    const controller = new AbortController();
    let resolve!: (applied: boolean) => void;
    const current = {
      controller,
      promise: new Promise<boolean>((done) => {
        resolve = done;
      }),
    };
    flight = current;
    options.onLoading?.(true, quiet);
    void (async () => {
      let applied = false;
      try {
        if (disposed || controller.signal.aborted) return false;
        const value = await options.load(controller.signal);
        if (!disposed && !controller.signal.aborted && flight === current) {
          options.onData(value);
          applied = true;
        }
      } catch (error) {
        if (!disposed && !controller.signal.aborted && flight === current)
          options.onError?.(error, quiet);
      } finally {
        if (flight === current) {
          if (!disposed) options.onLoading?.(false, quiet);
          flight = null;
          const next = queued;
          queued = null;
          if (next) {
            void request({ quiet: next.quiet }, next.automatic).then(next.resolve);
          } else schedule();
        }
      }
      return applied;
    })().then(resolve, () => resolve(false));
    return current.promise;
  }
  const automaticRefresh = () => {
    if (!paused && visible()) void request({ quiet: true }, true);
  };
  const visibilityChanged = () => {
    if (visible()) automaticRefresh();
    else {
      clearTimer();
      clearQueue();
      flight?.controller.abort();
    }
  };
  page?.addEventListener("visibilitychange", visibilityChanged);
  browser?.addEventListener("focus", automaticRefresh);

  return {
    refresh: (settings) => request(settings),
    setPaused(next, settings) {
      if (disposed || paused === next) return;
      paused = next;
      clearTimer();
      if (paused) {
        clearQueue();
        flight?.controller.abort();
      } else if (settings?.refreshOnResume !== false) automaticRefresh();
      else schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      clearQueue();
      flight?.controller.abort();
      page?.removeEventListener("visibilitychange", visibilityChanged);
      browser?.removeEventListener("focus", automaticRefresh);
    },
  };
}
