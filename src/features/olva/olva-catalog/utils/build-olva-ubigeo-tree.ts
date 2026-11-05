import type { OlvaUbigeo } from "../models/olva-ubigeo";
import type {
  OlvaUbigeoDepartmentNode,
  OlvaUbigeoProvinceNode,
  OlvaUbigeoTree,
} from "../models/olva-ubigeo-tree";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

/**
 * Groups the flat catalog as department -> province -> district, each level sorted by name.
 * Grouped by the INEI codes, not the names, so two places with the same name stay apart.
 * The catalog has thousands of rows: build it once (see `useOlvaUbigeoTree`).
 */
export function buildOlvaUbigeoTree(ubigeos: readonly OlvaUbigeo[]): OlvaUbigeoTree {
  const departments = new Map<
    string,
    { node: OlvaUbigeoDepartmentNode; provinces: Map<string, OlvaUbigeoProvinceNode> }
  >();

  for (const ubigeo of ubigeos) {
    let department = departments.get(ubigeo.departmentCode);

    if (!department) {
      department = { node: { name: ubigeo.department, provinces: [] }, provinces: new Map() };
      departments.set(ubigeo.departmentCode, department);
    }

    let province = department.provinces.get(ubigeo.provinceCode);

    if (!province) {
      province = { name: ubigeo.province, districts: [] };
      department.provinces.set(ubigeo.provinceCode, province);
      department.node.provinces.push(province);
    }

    province.districts.push({ name: ubigeo.district, ubigeo });
  }

  const tree = [...departments.values()].map(({ node }) => node);

  for (const department of tree) {
    department.provinces.sort(byName);
    for (const province of department.provinces) province.districts.sort(byName);
  }

  return tree.sort(byName);
}
