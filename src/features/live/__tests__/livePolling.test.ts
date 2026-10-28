import { createLivePolling, type LivePollingController } from "../livePolling";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};
let visibility = "visible";
const readers: LivePollingController[] = [];
function fixture(
  options: {
    interval?: number | (() => number);
    load?: (signal: AbortSignal) => Promise<string>;
  } = {},
) {
  const load = jest.fn(options.load ?? (() => Promise.resolve("current")));
  const onData = jest.fn(),
    onError = jest.fn(),
    onLoading = jest.fn();
  const reader = createLivePolling({
    load,
    onData,
    onError,
    onLoading,
    intervalMs: options.interval ?? 1000,
  });
  readers.push(reader);
  return { reader, load, onData, onError, onLoading };
}
beforeEach(() => {
  jest.useFakeTimers();
  visibility = "visible";
  jest
    .spyOn(document, "visibilityState", "get")
    .mockImplementation(() => visibility as DocumentVisibilityState);
});
afterEach(() => {
  for (const reader of readers.splice(0)) reader.dispose();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("starts the interval after a slow response and never overlaps its next automatic read", async () => {
  const pending = deferred<string>();
  const f = fixture({ load: () => pending.promise });
  const initial = f.reader.refresh({ quiet: false });
  await flush();
  expect(f.load).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(6000);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(1);
  pending.resolve("ready");
  await expect(initial).resolves.toBe(true);
  jest.advanceTimersByTime(999);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(f.onLoading).toHaveBeenCalledWith(true, false);
  expect(f.onLoading).toHaveBeenCalledWith(true, true);
});

test("coalesces focus, visibility and manual refresh calls while one valid read is in flight", async () => {
  const pending = deferred<string>();
  const f = fixture({ load: () => pending.promise });
  const first = f.reader.refresh();
  await flush();
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  const second = f.reader.refresh();
  expect(second).toBe(first);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(1);
  pending.resolve("current");
  await first;
  expect(f.onData).toHaveBeenCalledTimes(1);
});

test("supersedes and queues a fresh read after the old request settles, ignoring its late result", async () => {
  const old = deferred<string>(),
    next = deferred<string>();
  const f = fixture();
  f.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const initial = f.reader.refresh();
  await flush();
  const signal = f.load.mock.calls[0][0];
  const refresh = f.reader.refresh({ quiet: false, supersede: true });
  const duplicate = f.reader.refresh({ quiet: true, supersede: true });
  expect(duplicate).toBe(refresh);
  expect(signal.aborted).toBe(true);
  expect(f.load).toHaveBeenCalledTimes(1);
  old.resolve("stale");
  await expect(initial).resolves.toBe(false);
  await flush();
  expect(f.onData).not.toHaveBeenCalled();
  expect(f.load).toHaveBeenCalledTimes(2);
  next.resolve("fresh");
  await expect(refresh).resolves.toBe(true);
  expect(f.onData).toHaveBeenCalledWith("fresh");
});

test("hidden pages abort stale reads, do no work, and resume immediately without overlapping", async () => {
  const old = deferred<string>();
  const f = fixture();
  f.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce("visible result");
  void f.reader.refresh();
  await flush();
  visibility = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(f.load.mock.calls[0][0].aborted).toBe(true);
  jest.advanceTimersByTime(10000);
  await expect(f.reader.refresh()).resolves.toBe(false);
  window.dispatchEvent(new Event("focus"));
  expect(f.load).toHaveBeenCalledTimes(1);
  visibility = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  old.resolve("hidden stale result");
  await flush();
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(f.onData).toHaveBeenCalledTimes(1);
  expect(f.onData).toHaveBeenCalledWith("visible result");
});

test("pauses automatic work for an action but permits one explicit post-mutation reconciliation", async () => {
  const old = deferred<string>();
  const f = fixture();
  f.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce("after mutation");
  void f.reader.refresh();
  await flush();
  f.reader.setPaused(true);
  expect(f.load.mock.calls[0][0].aborted).toBe(true);
  window.dispatchEvent(new Event("focus"));
  jest.advanceTimersByTime(5000);
  const reconciliation = f.reader.refresh({ quiet: true, supersede: true });
  old.resolve("before mutation");
  await expect(reconciliation).resolves.toBe(true);
  expect(f.onData).toHaveBeenCalledWith("after mutation");
  jest.advanceTimersByTime(5000);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(2);
  f.reader.setPaused(false, { refreshOnResume: false });
  jest.advanceTimersByTime(999);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(3);
});

test("resuming an action refreshes immediately and deduplicates a simultaneous focus event", async () => {
  const pending = deferred<string>();
  const f = fixture({ load: () => pending.promise });
  f.reader.setPaused(true);
  f.reader.setPaused(false);
  window.dispatchEvent(new Event("focus"));
  await flush();
  expect(f.load).toHaveBeenCalledTimes(1);
  pending.resolve("resumed");
  await flush();
  expect(f.onData).toHaveBeenCalledWith("resumed");
});

test("a scoped reader cannot apply late responses or errors after disposal", async () => {
  const old = deferred<string>();
  const first = fixture({ load: () => old.promise });
  const oldRead = first.reader.refresh({ quiet: false });
  await flush();
  const queued = first.reader.refresh({ supersede: true });
  first.reader.dispose();
  const next = fixture();
  await next.reader.refresh();
  old.reject(new Error("old visitor or store failed"));
  await expect(oldRead).resolves.toBe(false);
  await expect(queued).resolves.toBe(false);
  expect(first.onData).not.toHaveBeenCalled();
  expect(first.onError).not.toHaveBeenCalled();
  expect(first.onLoading).not.toHaveBeenCalledWith(false, false);
  expect(next.onData).toHaveBeenCalledWith("current");
});

test("recovers from failures and uses the latest adaptive interval", async () => {
  let interval = 1000;
  const f = fixture({ interval: () => interval });
  f.load.mockRejectedValueOnce(new Error("temporarily unavailable"));
  await expect(f.reader.refresh()).resolves.toBe(false);
  expect(f.onError).toHaveBeenCalledWith(expect.any(Error), true);
  interval = 3000;
  jest.advanceTimersByTime(1000);
  await flush();
  expect(f.onData).toHaveBeenCalledWith("current");
  jest.advanceTimersByTime(2999);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1);
  await flush();
  expect(f.load).toHaveBeenCalledTimes(3);
});

test("dispose removes timers and focus/visibility listeners, including Strict Mode recreation", async () => {
  const first = fixture();
  await first.reader.refresh();
  first.reader.dispose();
  const next = fixture();
  await next.reader.refresh();
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(first.load).toHaveBeenCalledTimes(1);
  expect(next.load).toHaveBeenCalledTimes(2);
  next.reader.dispose();
  jest.advanceTimersByTime(10000);
  await flush();
  expect(next.load).toHaveBeenCalledTimes(2);
});
