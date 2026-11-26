import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy* / waitFor default to 1 s, which vitest's testTimeout does not cover. Async UI (query
// resolution + re-render) is slower on a loaded machine or CI, so give it more room
configure({ asyncUtilTimeout: 5000 });

// Vitest globals are off, so Testing Library cannot register its own cleanup
afterEach(() => {
  cleanup();
});

// jsdom lacks these browser APIs, which Radix primitives (Dialog, Switch) rely on
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
