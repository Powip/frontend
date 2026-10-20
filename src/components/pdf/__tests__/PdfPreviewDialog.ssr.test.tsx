/** @jest-environment node */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Radix portals omit their contents during SSR. Render the dialog shell inline
// so this test also exercises the viewer branch, using the real next/dynamic.
jest.mock("@/components/ui/dialog", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const Wrapper = ({ children }: { children?: ReactNode }) =>
    React.createElement("div", null, children);
  return {
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogFooter: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
  };
});

test("imports and renders an empty preview in Node without browser PDF globals", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  expect(typeof DOMMatrix).toBe("undefined");

  const { PdfPreviewDialog } = await import("../PdfPreviewDialog");
  const html = renderToStaticMarkup(
    createElement(PdfPreviewDialog, {
      open: false,
      onOpenChange: jest.fn(),
      file: null,
    }),
  );

  expect(html).toContain("Descargar");
  expect(html).toContain("Imprimir");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).not.toContain("Cargando PDF...");
});

test("server rendering a selected file only shows the loading UI and never initializes PDF.js", async () => {
  const { PdfPreviewDialog } = await import("../PdfPreviewDialog");
  const onOpenChange = jest.fn();
  const html = renderToStaticMarkup(
    createElement(PdfPreviewDialog, {
      open: true,
      onOpenChange,
      file: {
        blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
        filename: "comprobante.pdf",
      },
    }),
  );

  expect(html).toContain("comprobante.pdf");
  expect(html).toContain("Cargando PDF...");
  expect(html).not.toContain("disabled=\"\"");
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(typeof DOMMatrix).toBe("undefined");
});
