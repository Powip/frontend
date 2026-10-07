import type { Role, User } from "@/interfaces/IUser";

export const ALL_ROLES_FILTER = "__all_roles__";
export const NO_ROLE_FILTER = "__no_role__";

export type StatusFilter = "all" | "active" | "inactive";
export type SortKey = "login" | "name" | "surname" | "email" | "status";
export type SortDirection = "asc" | "desc";

export interface RoleOption {
  key: string;
  id?: string;
  name: string;
  label: string;
  description?: string;
  inCatalog: boolean;
}

export interface UserSummary {
  total: number;
  active: number;
  inactive: number;
  withoutRole: number;
}

export interface UserFilters {
  query: string;
  roleKey: string;
  status: StatusFilter;
}

type RoleLike = { id?: string | null; name?: string | null; description?: string | null };

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

const normalizeRoleName = (name?: string | null) => (name ?? "").trim().toUpperCase();

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const hasRole = (user: User) => !!normalizeRoleName(user.role?.name);

const resolveRoleOption = <T extends Omit<RoleOption, "label">>(role: RoleLike, options: T[]): T | null => {
  const name = normalizeRoleName(role.name);
  if (role.id) {
    const byId = options.find((option) => option.id === role.id);
    if (byId) return byId;
    const withoutId = options.filter((option) => !option.id && normalizeRoleName(option.name) === name);
    return withoutId.length === 1 ? withoutId[0] : null;
  }
  const sameName = options.filter((option) => normalizeRoleName(option.name) === name);
  if (sameName.length === 1) return sameName[0];
  const withoutId = sameName.filter((option) => !option.id);
  return withoutId.length === 1 ? withoutId[0] : null;
};

const withLabels = (options: Omit<RoleOption, "label">[]): RoleOption[] =>
  options.map((option) => {
    const repeated =
      options.filter((other) => normalizeRoleName(other.name) === normalizeRoleName(option.name)).length > 1;
    const identity = repeated ? ` · ${option.id ? `id ${option.id}` : "sin id"}` : "";
    const origin = option.inCatalog ? "" : " (fuera del catálogo)";
    return { ...option, label: `${option.name}${identity}${origin}` };
  });

const optionKeyFor = (role: RoleLike) =>
  role.id ? `id:${role.id}` : `name:${normalizeRoleName(role.name)}`;

export function buildRoleOptions(catalog: Role[], users: User[]): RoleOption[] {
  const options: Omit<RoleOption, "label">[] = [];

  for (const role of catalog) {
    if (!normalizeRoleName(role.name)) continue;
    if (role.id ? options.some((option) => option.id === role.id) : resolveRoleOption(role, options)) continue;
    options.push({
      key: optionKeyFor(role),
      id: role.id || undefined,
      name: role.name.trim(),
      description: role.description?.trim() || undefined,
      inCatalog: true,
    });
  }

  const idsByName = new Map<string, Set<string>>();
  for (const user of users) {
    if (!user.role?.id || !hasRole(user)) continue;
    const name = normalizeRoleName(user.role.name);
    idsByName.set(name, (idsByName.get(name) ?? new Set()).add(user.role.id));
  }

  const extras: Omit<RoleOption, "label">[] = [];
  for (const user of users) {
    const role = user.role;
    if (!role || !hasRole(user)) continue;
    const known = [...options, ...extras];
    const nameIsShared = !!role.id && (idsByName.get(normalizeRoleName(role.name))?.size ?? 0) > 1;
    const resolved = nameIsShared
      ? known.find((option) => option.id === role.id)
      : resolveRoleOption(role, known);
    if (resolved) continue;
    if (known.some((option) => option.key === optionKeyFor(role))) continue;
    extras.push({
      key: optionKeyFor(role),
      id: role.id || undefined,
      name: role.name.trim(),
      inCatalog: false,
    });
  }
  extras.sort((a, b) => collator.compare(a.name, b.name));

  return withLabels([...options, ...extras]);
}

export function findRoleOptionKey(user: User, options: RoleOption[]): string | null {
  const role = user.role;
  if (!role || !hasRole(user)) return null;
  return resolveRoleOption(role, options)?.key ?? null;
}

export function summarizeUsers(users: User[]): UserSummary {
  const active = users.filter((user) => user.status === true).length;
  return {
    total: users.length,
    active,
    inactive: users.length - active,
    withoutRole: users.filter((user) => !hasRole(user)).length,
  };
}

export function countUsersByRole(users: User[], options: RoleOption[]): Map<string, number> {
  const counts = new Map<string, number>(options.map((option) => [option.key, 0]));
  for (const user of users) {
    const key = findRoleOptionKey(user, options);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function filterUsers(users: User[], filters: UserFilters, options: RoleOption[]): User[] {
  const query = normalizeText(filters.query);

  return users.filter((user) => {
    if (filters.status === "active" && user.status !== true) return false;
    if (filters.status === "inactive" && user.status === true) return false;

    if (filters.roleKey === NO_ROLE_FILTER) {
      if (hasRole(user)) return false;
    } else if (filters.roleKey !== ALL_ROLES_FILTER) {
      if (findRoleOptionKey(user, options) !== filters.roleKey) return false;
    }

    if (!query) return true;
    return [
      user.username,
      user.name,
      user.surname,
      user.email,
      user.identityDocument,
      user.phoneNumber,
      user.role?.name,
      user.district,
      user.address,
    ].some((field) => normalizeText(field).includes(query));
  });
}

const compareText = (a?: string | null, b?: string | null) => collator.compare(a ?? "", b ?? "");

const compareStatus = (a: User, b: User) => Number(b.status === true) - Number(a.status === true);

export const loginOf = (user: User) => user.username?.trim() ?? "";

const tieBreakers: Record<SortKey, Array<(a: User, b: User) => number>> = {
  login: [
    (a, b) => compareText(a.name, b.name),
    (a, b) => compareText(a.surname, b.surname),
  ],
  name: [
    (a, b) => compareText(a.surname, b.surname),
    (a, b) => compareText(a.email, b.email),
  ],
  surname: [
    (a, b) => compareText(a.name, b.name),
    (a, b) => compareText(a.email, b.email),
  ],
  email: [
    (a, b) => compareText(a.name, b.name),
    (a, b) => compareText(a.surname, b.surname),
  ],
  status: [
    (a, b) => compareText(a.name, b.name),
    (a, b) => compareText(a.surname, b.surname),
    (a, b) => compareText(a.email, b.email),
  ],
};

const primaryComparators: Record<SortKey, (a: User, b: User) => number> = {
  login: (a, b) => compareText(loginOf(a), loginOf(b)),
  name: (a, b) => compareText(a.name, b.name),
  surname: (a, b) => compareText(a.surname, b.surname),
  email: (a, b) => compareText(a.email, b.email),
  status: compareStatus,
};

export function sortUsers(users: User[], key: SortKey, direction: SortDirection): User[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...users].sort((a, b) => {
    const primary = primaryComparators[key](a, b) * sign;
    if (primary !== 0) return primary;
    for (const compare of tieBreakers[key]) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return compareText(a.id, b.id);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
    startIndex: start,
  };
}
