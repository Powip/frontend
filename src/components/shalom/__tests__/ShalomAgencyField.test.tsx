/* eslint-disable @typescript-eslint/no-require-imports */
/** Buscador de agencias Shalom compartido (Registrar venta). HTTP con mock: nada sale a Shalom. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://integrations/" } }));
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  function text(node: any): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    return Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  }
  function Select({ value, onValueChange, children, disabled }: any) {
    const options: Array<{ value: string; label: string }> = [];
    function visit(nodes: any) {
      React.Children.forEach(nodes, (node: any) => {
        if (!React.isValidElement(node)) return;
        const props = node.props as any;
        if (props.value !== undefined) options.push({ value: props.value, label: text(props.children) });
        else visit(props.children);
      });
    }
    visit(children);
    return <select aria-label="Agencia" value={value ?? ""} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)}>
      <option value="">Selecciona</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  const Pass = ({ children }: any) => <>{children}</>;
  return { Select, SelectContent: Pass, SelectTrigger: Pass, SelectItem: Pass, SelectValue: () => null };
});

import axiosAuth from "@/lib/axiosAuth";
import { ShalomAgencyField, SHALOM_AGENCY_FIELD_MAX_OPTIONS } from "../ShalomAgencyField";

const get = axiosAuth.get as jest.Mock;
const raw = (id: number, nombre: string, extra: Record<string, unknown> = {}) =>
  ({ ter_id: id, nombre, lugar_over: `${nombre} API`, lugar: `Dirección ${id}`, ter_aereo: 0, departamento: "LIMA", provincia: "LIMA", ...extra });
const ok = (data: unknown[]) => ({ data: { success: true, total: data.length, data } });
const CATALOG = [
  raw(1, "MIRAFLORES OVALO"),
  raw(2, "SURCO CHACARILLA"),
  raw(3, "HUACHO PLAZA", { provincia: "HUAURA" }),
  raw(4, "CUSCO WANCHAQ", { departamento: "CUSCO", provincia: "CUSCO", ter_aereo: 1 }),
];
const urls = () => get.mock.calls.map(([url]) => decodeURIComponent(String(url)));
const select = () => screen.getByRole("combobox", { name: "Agencia" });
const search = () => screen.getByPlaceholderText("Distrito, provincia o nombre de agencia");
const optionNames = () => within(select()).getAllByRole("option").slice(1).map((option) => option.getAttribute("value"));
const loaded = () => waitFor(() => expect(optionNames().length).toBeGreaterThan(0));
const MIRAFLORES = { department: "Lima", province: "Lima", district: "Miraflores" };

type Props = React.ComponentProps<typeof ShalomAgencyField>;
function mount(props: Partial<Props> = {}) {
  const onSelect = jest.fn();
  const onClear = jest.fn();
  const element = (extra: Partial<Props> = {}) =>
    <ShalomAgencyField label="Agencia Shalom de recojo" selectedAgency="" onSelect={onSelect} onClear={onClear} {...props} {...extra} />;
  const view = render(element());
  return { onSelect, onClear, update: (extra: Partial<Props>) => view.rerender(element(extra)) };
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(ok(CATALOG));
});

describe("ShalomAgencyField — catálogo y búsqueda", () => {
  it("carga el catálogo completo (GET /shalom/agencies) con la sesión y deja elegir una agencia", async () => {
    const user = userEvent.setup();
    const { onSelect } = mount();
    await loaded();
    expect(urls()).toEqual(["http://integrations/shalom/agencies"]);
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API", "SURCO CHACARILLA API", "HUACHO PLAZA API", "CUSCO WANCHAQ API"]);
    expect(within(select()).getByRole("option", { name: /CUSCO WANCHAQ.*Terrestre \+ Aéreo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver todas/i })).not.toBeInTheDocument();

    await user.selectOptions(select(), "CUSCO WANCHAQ API");
    expect(onSelect).toHaveBeenCalledWith({
      id_agencia: "4", nombre_agencia: "CUSCO WANCHAQ", api_name: "CUSCO WANCHAQ API", direccion: "Dirección 4",
      ter_aereo: 1, departamento: "CUSCO", provincia: "CUSCO",
    });
  });

  it("al escribir espera a que se deje de tipear: una llamada a /search/:q, no una por tecla", async () => {
    const user = userEvent.setup();
    mount();
    await loaded();
    get.mockResolvedValue(ok([raw(9, "AREQUIPA CERCADO", { departamento: "AREQUIPA", provincia: "AREQUIPA" })]));
    await user.type(search(), "Arequipa");
    await within(select()).findByRole("option", { name: /AREQUIPA CERCADO/ });
    expect(urls()).toEqual(["http://integrations/shalom/agencies", "http://integrations/shalom/agencies/search/Arequipa"]);
  });

  it("repite un término desde la caché (sin tildes ni mayúsculas) y vuelve al catálogo sin otra llamada", async () => {
    const user = userEvent.setup();
    mount();
    await loaded();
    await user.type(search(), "Junín");
    await waitFor(() => expect(urls()).toHaveLength(2));
    await user.clear(search());
    await user.type(search(), "JUNIN");
    await new Promise((resolve) => setTimeout(resolve, 600));
    await user.clear(search());
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(urls()).toEqual(["http://integrations/shalom/agencies", "http://integrations/shalom/agencies/search/Junín"]);
    expect(optionNames()).toHaveLength(CATALOG.length);
  });

  it("una respuesta vieja que llega tarde no pisa la búsqueda actual", async () => {
    const user = userEvent.setup();
    let releaseOld: (value: unknown) => void = () => {};
    mount();
    await loaded();
    get.mockImplementation((url: string) => url.endsWith("/Cusco")
      ? new Promise((resolve) => { releaseOld = resolve; })
      : Promise.resolve(ok([raw(9, "AREQUIPA CERCADO")])));
    await user.type(search(), "Cusco");
    await waitFor(() => expect(urls()).toHaveLength(2));
    await user.clear(search());
    await user.type(search(), "Arequipa");
    await within(select()).findByRole("option", { name: /AREQUIPA CERCADO/ });
    releaseOld(ok([raw(4, "CUSCO WANCHAQ")]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(optionNames()).toEqual(["AREQUIPA CERCADO API"]);
    expect(select()).toBeEnabled();
  });

  it("un fallo del catálogo no rompe el campo ni queda en caché", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    get.mockRejectedValueOnce(new Error("Shalom 522"));
    const first = render(<ShalomAgencyField label="Agencia" selectedAgency="" onSelect={jest.fn()} />);
    await waitFor(() => expect(select()).toBeEnabled());
    expect(within(select()).getAllByRole("option")).toHaveLength(1);
    first.unmount();
    mount();
    await loaded();
    expect(urls()).toHaveLength(2);
    error.mockRestore();
  });

  it("acota un catálogo grande, avisa cuántas hay y conserva la agencia ya elegida", async () => {
    const total = SHALOM_AGENCY_FIELD_MAX_OPTIONS + 20;
    get.mockResolvedValue(ok(Array.from({ length: total }, (_value, index) => raw(index + 1, `AGENCIA ${index + 1}`))));
    mount({ selectedAgency: `AGENCIA ${total} API` });
    await loaded();
    expect(screen.getByText(`Mostrando ${SHALOM_AGENCY_FIELD_MAX_OPTIONS} de ${total} agencias. Escribe para acotar la búsqueda.`)).toBeInTheDocument();
    expect(optionNames()).toHaveLength(SHALOM_AGENCY_FIELD_MAX_OPTIONS + 1);
    expect(select()).toHaveValue(`AGENCIA ${total} API`);
  });

  it("bloqueado no deja buscar ni elegir", async () => {
    mount({ disabled: true, location: MIRAFLORES });
    await waitFor(() => expect(get).toHaveBeenCalled());
    await screen.findByRole("button", { name: "Ver todas las agencias" });
    expect(search()).toBeDisabled();
    expect(select()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ver todas las agencias" })).toBeDisabled();
  });
});

describe("ShalomAgencyField — filtro por ubicación del cliente", () => {
  it("muestra solo las agencias del distrito del cliente, con una sola carga del catálogo", async () => {
    mount({ location: MIRAFLORES });
    await loaded();
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API"]);
    expect(screen.getByText("Mostrando las agencias del distrito Miraflores (1).")).toBeInTheDocument();
    expect(urls()).toEqual(["http://integrations/shalom/agencies"]);
  });

  it("sin agencias en el distrito pasa a la provincia y, si tampoco, al departamento", async () => {
    const { update } = mount({ location: { department: "Lima", province: "Lima", district: "San Borja" } });
    await loaded();
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API", "SURCO CHACARILLA API"]);
    expect(screen.getByText("No hay agencias en San Borja. Mostrando las agencias de la provincia Lima (2).")).toBeInTheDocument();

    update({ location: { department: "LIMA", province: "Cañete", district: "Asia" } });
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API", "SURCO CHACARILLA API", "HUACHO PLAZA API"]);
    expect(screen.getByText("No hay agencias en Asia. Mostrando las agencias del departamento LIMA (3).")).toBeInTheDocument();
  });

  it("«Ver todas las agencias» quita el filtro y permite volver a él", async () => {
    const user = userEvent.setup();
    const { onSelect } = mount({ location: MIRAFLORES });
    await loaded();
    await user.click(screen.getByRole("button", { name: "Ver todas las agencias" }));
    expect(optionNames()).toHaveLength(CATALOG.length);
    expect(screen.getByText("Mostrando todas las agencias.")).toBeInTheDocument();
    await user.selectOptions(select(), "CUSCO WANCHAQ API");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ nombre_agencia: "CUSCO WANCHAQ" }));

    await user.click(screen.getByRole("button", { name: "Ver solo las de la ubicación del cliente" }));
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API"]);
    expect(urls()).toEqual(["http://integrations/shalom/agencies"]);
  });

  it("con el filtro activo, escribir acota dentro de la zona sin consultar al servidor", async () => {
    const user = userEvent.setup();
    mount({ location: { department: "Lima", province: "Lima", district: "San Borja" } });
    await loaded();
    await user.type(search(), "chacarilla");
    expect(optionNames()).toEqual(["SURCO CHACARILLA API"]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(urls()).toEqual(["http://integrations/shalom/agencies"]);
  });

  it("si lo escrito no coincide en la zona del cliente, busca en todas las agencias y lo avisa", async () => {
    const user = userEvent.setup();
    const { onSelect } = mount({ location: MIRAFLORES });
    await loaded();
    await user.type(search(), "wanchaq");
    expect(optionNames()).toEqual(["CUSCO WANCHAQ API"]);
    expect(
      screen.getByText("No hay agencias con «wanchaq» en el distrito Miraflores. Mostrando coincidencias de todas las agencias (1)."),
    ).toBeInTheDocument();
    await user.selectOptions(select(), "CUSCO WANCHAQ API");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ nombre_agencia: "CUSCO WANCHAQ" }));

    // Al borrar lo escrito vuelve al filtro de la zona; todo sale del catálogo ya cargado.
    await user.clear(search());
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API"]);
    expect(screen.getByText("Mostrando las agencias del distrito Miraflores (1).")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(urls()).toEqual(["http://integrations/shalom/agencies"]);
  });

  it("si lo escrito no coincide en la zona ni en el resto de agencias, lo dice", async () => {
    const user = userEvent.setup();
    mount({ location: MIRAFLORES });
    await loaded();
    await user.type(search(), "zzz");
    expect(optionNames()).toEqual([]);
    expect(screen.getByText("No hay agencias con «zzz» en el distrito Miraflores ni en el resto de agencias.")).toBeInTheDocument();
  });

  it("si no hay agencias para la ubicación muestra todas y lo avisa", async () => {
    mount({ location: { department: "Tacna", province: "Tacna", district: "Tacna" } });
    await loaded();
    expect(optionNames()).toHaveLength(CATALOG.length);
    expect(screen.getByText("No hay agencias Shalom para la ubicación del cliente. Se muestran todas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver todas/i })).not.toBeInTheDocument();
  });

  it("al cambiar la dirección vuelve a filtrar y limpia la agencia elegida si ya no aplica", async () => {
    const { onClear, update } = mount({ location: MIRAFLORES, selectedAgency: "MIRAFLORES OVALO API" });
    await loaded();
    update({ location: { department: "Cusco", province: "Cusco", district: "Wanchaq" }, selectedAgency: "MIRAFLORES OVALO API" });
    expect(onClear).toHaveBeenCalledTimes(1);
    update({ location: { department: "Cusco", province: "Cusco", district: "Wanchaq" }, selectedAgency: "" });
    expect(optionNames()).toEqual(["CUSCO WANCHAQ API"]);
  });

  it("al cambiar la dirección conserva la agencia si sigue siendo válida, aunque cambien tildes o mayúsculas", async () => {
    const { onClear, update } = mount({ location: { department: "Lima", province: "Lima", district: "San Borja" }, selectedAgency: "SURCO CHACARILLA API" });
    await loaded();
    update({ location: { department: "LIMA", province: "LIMA", district: "SAN BORJA" }, selectedAgency: "SURCO CHACARILLA API" });
    update({ location: { department: "Lima", province: "Lima", district: "Surco" }, selectedAgency: "SURCO CHACARILLA API" });
    expect(onClear).not.toHaveBeenCalled();
    expect(optionNames()).toEqual(["SURCO CHACARILLA API"]);
    expect(select()).toHaveValue("SURCO CHACARILLA API");
  });

  it("una agencia elegida viendo todas se limpia cuando la nueva dirección no la incluye, y el filtro vuelve", async () => {
    const user = userEvent.setup();
    const { onClear, update } = mount({ location: MIRAFLORES, selectedAgency: "CUSCO WANCHAQ API" });
    await loaded();
    expect(onClear).not.toHaveBeenCalled();
    expect(select()).toHaveValue("CUSCO WANCHAQ API");
    await user.click(screen.getByRole("button", { name: "Ver todas las agencias" }));
    update({ location: { department: "Lima", province: "Huaura", district: "Huacho" }, selectedAgency: "CUSCO WANCHAQ API" });
    expect(onClear).toHaveBeenCalledTimes(1);
    update({ location: { department: "Lima", province: "Huaura", district: "Huacho" }, selectedAgency: "" });
    expect(optionNames()).toEqual(["HUACHO PLAZA API"]);
  });
});
