import { adaptPlans, planDisplayName } from "../planCatalog";

const names = ["Basic", "Medium", "Scale", "Enterprise"].map((name) => ({ name }));

describe("adaptPlans", () => {
  it("cada plan lleva su límite de pedidos como primera característica", () => {
    const [basic, medium, scale] = adaptPlans(names);
    expect(basic.features[0]).toBe("Hasta 1,000 pedidos/mes");
    expect(medium.features[0]).toBe("Hasta 2,000 pedidos/mes");
    expect(scale.features[0]).toBe("Hasta 6,000 pedidos/mes");
  });

  it("Basic, Medium y Scale incluyen lo mismo salvo el volumen de pedidos", () => {
    const [basic, medium, scale] = adaptPlans(names);
    expect(basic.features.slice(1)).toEqual([
      "Todos los módulos incluidos",
      "Usuarios ilimitados",
      "Todos tus canales de venta",
      "Inventario y almacenes",
      "Automatización de envíos",
      "Reportes y métricas",
      "Soporte por chat",
    ]);
    expect(medium.features.slice(1)).toEqual(basic.features.slice(1));
    expect(scale.features.slice(1)).toEqual(basic.features.slice(1));
    expect([basic.limits, medium.limits, scale.limits]).toEqual([[], [], []]);
  });

  it("el público objetivo y el plan popular son los de la propuesta comercial", () => {
    const [basic, medium, scale] = adaptPlans(names);
    expect([basic.target, medium.target, scale.target]).toEqual([
      "Ideal para empezar",
      "Para negocios en crecimiento",
      "Para altos volúmenes",
    ]);
    expect([basic.popular, medium.popular, scale.popular]).toEqual([false, true, false]);
  });

  it("los planes anuales usan el texto de su plan base", () => {
    const [medium] = adaptPlans([{ name: "Medium Anual" }]);
    expect(medium.features[0]).toBe("Hasta 2,000 pedidos/mes");
    expect(medium.popular).toBe(true);
  });

  it("Enterprise conserva su texto", () => {
    const enterprise = adaptPlans(names)[3];
    expect(enterprise.target).toBe("Grandes corporaciones");
    expect(enterprise.features[0]).toBe("Pedidos Ilimitados");
  });
});

describe("planDisplayName", () => {
  it("Medium se muestra como Standard y Scale como Full", () => {
    expect(planDisplayName("Medium")).toBe("Standard");
    expect(planDisplayName("Scale")).toBe("Full");
  });

  it("quita el sufijo Anual y respeta mayúsculas del backend", () => {
    expect(planDisplayName("Medium Anual")).toBe("Standard");
    expect(planDisplayName("scale anual")).toBe("Full");
  });

  it("Basic y Enterprise no cambian de nombre", () => {
    expect(planDisplayName("Basic")).toBe("Basic");
    expect(planDisplayName("Basic Anual")).toBe("Basic");
    expect(planDisplayName("Enterprise")).toBe("Enterprise");
  });
});
