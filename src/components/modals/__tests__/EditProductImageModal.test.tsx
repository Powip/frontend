import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { updateProductImage } from "@/services/productImageService";
import EditProductImageModal from "../EditProductImageModal";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} />,
}));
jest.mock("@/services/productImageService", () => ({
  ...jest.requireActual("@/services/productImageService"),
  updateProductImage: jest.fn(),
}));

const updateImage = jest.mocked(updateProductImage);
const item: InventoryItemForSale = {
  inventoryItemId: "item-a", productId: "product-a", variantId: "variant-a",
  productName: "Rosario Perlas", sku: "SKU-A", price: 10,
  availableStock: 0, physicalStock: 0,
};
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:test-product-image");
  URL.revokeObjectURL = jest.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function setup(imageUrl?: string) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  const view = render(<EditProductImageModal item={{ ...item, imageUrl }} onClose={onClose} onSuccess={onSuccess} />);
  return { ...view, onClose, onSuccess };
}

it("previsualiza la foto y confirma solo después de guardarla", async () => {
  const { onClose, onSuccess, unmount } = setup();
  const file = new File(["image"], "rosario.png", { type: "image/png" });
  expect(screen.getByRole("button", { name: "Guardar imagen" })).toBeDisabled();
  await userEvent.upload(screen.getByLabelText("Seleccionar nueva imagen"), file);
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:test-product-image");
  updateImage.mockResolvedValueOnce("https://images.test/rosario.png");
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("https://images.test/rosario.png"));
  expect(updateImage).toHaveBeenCalledWith({ productId: "product-a", variantId: "variant-a", file });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledTimes(1);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-product-image");
});

it("conserva la foto anterior y permite reintentar si falla el guardado", async () => {
  const { onClose, onSuccess } = setup("https://images.test/previous.png");
  expect(screen.getByRole("img")).toHaveAttribute("src", "https://images.test/previous.png");
  await userEvent.upload(screen.getByLabelText("Seleccionar nueva imagen"), new File(["image"], "rosario.png", { type: "image/png" }));
  updateImage.mockRejectedValueOnce(new Error("No se pudo subir la imagen"));
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo subir la imagen");
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  updateImage.mockResolvedValueOnce("https://images.test/retry.png");
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("https://images.test/retry.png"));
});

it("rechaza archivos inválidos sin guardar ni quitar la foto actual", () => {
  setup("https://images.test/previous.png");
  fireEvent.change(screen.getByLabelText("Seleccionar nueva imagen"), {
    target: { files: [new File(["not-image"], "document.pdf", { type: "application/pdf" })] },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("JPG, PNG, WebP o GIF");
  expect(screen.getByRole("button", { name: "Guardar imagen" })).toBeDisabled();
  expect(screen.getByRole("img")).toHaveAttribute("src", "https://images.test/previous.png");
  expect(updateImage).not.toHaveBeenCalled();
});

it("distingue una imagen guardada de un fallo posterior al actualizar la tabla", async () => {
  const { onClose, onSuccess } = setup();
  onSuccess.mockRejectedValueOnce(new Error("Cache update failed"));
  updateImage.mockResolvedValueOnce("https://images.test/saved.png");
  await userEvent.upload(screen.getByLabelText("Seleccionar nueva imagen"), new File(["image"], "rosario.png", { type: "image/png" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(toast.warning).toHaveBeenCalledWith("Imagen guardada, pero no se pudo actualizar el almacén. Recarga la página.");
  expect(toast.error).not.toHaveBeenCalled();
});

it("impide cerrar o enviar de nuevo mientras se guarda", async () => {
  const { onClose } = setup();
  let finish!: (url: string) => void;
  updateImage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await userEvent.upload(screen.getByLabelText("Seleccionar nueva imagen"), new File(["image"], "rosario.png", { type: "image/png" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  finish("https://images.test/saved.png");
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(updateImage).toHaveBeenCalledTimes(1);
});
