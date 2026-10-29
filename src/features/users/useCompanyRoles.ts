"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CompanyRole,
  getCompanyRoles,
  getRoleAccess,
  type RoleAccess,
  userError,
} from "./rolesService";

interface State {
  scope: string;
  access: RoleAccess | null;
  roles: CompanyRole[];
  loading: boolean;
  error: string;
}
export function useCompanyRoles() {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const companyId = auth?.company?.id;
  const bearer = auth?.accessToken;
  const scope = `${userId || ""}:${companyId || ""}:${bearer || ""}`;
  const active = useRef(scope);
  active.current = scope;
  const request = useRef(0);
  const [state, setState] = useState<State>({
    scope: "",
    access: null,
    roles: [],
    loading: true,
    error: "",
  });
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    const current = () => active.current === scope && request.current === sequence;
    setState({ scope, access: null, roles: [], loading: true, error: "" });
    if (!userId || !companyId || !bearer) {
      if (current())
        setState({
          scope,
          access: null,
          roles: [],
          loading: false,
          error: "Selecciona un negocio para administrar sus perfiles.",
        });
      return;
    }
    try {
      const access = await getRoleAccess(userId, companyId);
      if (!current()) return;
      const roles = access.canRead ? await getCompanyRoles() : [];
      if (current()) setState({ scope, access, roles, loading: false, error: "" });
    } catch (cause) {
      if (current())
        setState({ scope, access: null, roles: [], loading: false, error: userError(cause) });
    }
  }, [scope, userId, companyId, bearer]);
  useEffect(() => {
    void refresh();
    return () => {
      ++request.current;
    };
  }, [refresh]);
  const current =
    state.scope === scope ? state : { scope, access: null, roles: [], loading: true, error: "" };
  return { ...current, refresh };
}
