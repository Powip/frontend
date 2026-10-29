import { render, screen } from "@testing-library/react";
import ImportExcelModal from "../ImportExcelModal";
jest.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper };
});
jest.mock("@/components/excel/ExcelImportWizard", () => ({ __esModule: true, default: ({ inventoryId }: { inventoryId?: string }) => <div data-testid="destination">{inventoryId || "choose-warehouse"}</div> }));
it("preserves the physical destination selected in stock when opening the import wizard", () => {
  render(<ImportExcelModal open onClose={jest.fn()} onSuccess={jest.fn()} inventoryId="warehouse-real" />);
  expect(screen.getByTestId("destination")).toHaveTextContent("warehouse-real");
});
it("leaves the destination chooser available when viewing all warehouses", () => {
  render(<ImportExcelModal open onClose={jest.fn()} onSuccess={jest.fn()} inventoryId="" />);
  expect(screen.getByTestId("destination")).toHaveTextContent("choose-warehouse");
});
