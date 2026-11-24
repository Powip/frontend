import { copyLiveText } from "../liveCopy";

// FEAT-33 A2: «Copiar link» tiene que funcionar también donde el portapapeles moderno no existe.
const setClipboard = (writeText?: jest.Mock) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
const setExecCommand = (result: boolean | Error) => {
  const fn = jest.fn(() => {
    if (result instanceof Error) throw result;
    return result;
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: fn,
  });
  return fn;
};

afterEach(() => {
  setClipboard(undefined);
  document.body.innerHTML = "";
});

test("uses the clipboard API when the browser allows it", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  setClipboard(writeText);
  const exec = setExecCommand(true);
  await expect(copyLiveText("https://a.test/live")).resolves.toBe("copied");
  expect(writeText).toHaveBeenCalledWith("https://a.test/live");
  expect(exec).not.toHaveBeenCalled();
});

test("falls back to a hidden textarea and execCommand when the clipboard API is refused", async () => {
  setClipboard(jest.fn().mockRejectedValue(new Error("NotAllowed")));
  let copiedValue = "";
  const exec = setExecCommand(true);
  exec.mockImplementation(() => {
    copiedValue = (document.activeElement as HTMLTextAreaElement).value;
    return true;
  });
  await expect(copyLiveText("https://a.test/live?a=ANA")).resolves.toBe(
    "copied",
  );
  expect(exec).toHaveBeenCalledWith("copy");
  expect(copiedValue).toBe("https://a.test/live?a=ANA");
  expect(document.querySelector("textarea")).toBeNull();
});

test("falls back when there is no clipboard API at all (http, iframe, old Safari)", async () => {
  setClipboard(undefined);
  setExecCommand(true);
  await expect(copyLiveText("x")).resolves.toBe("copied");
});

test.each([false, new Error("unsupported")])(
  "asks for a manual copy when both methods fail (%p)",
  async (result) => {
    setClipboard(jest.fn().mockRejectedValue(new Error("NotAllowed")));
    setExecCommand(result);
    await expect(copyLiveText("x")).resolves.toBe("manual");
    expect(document.querySelector("textarea")).toBeNull();
  },
);
