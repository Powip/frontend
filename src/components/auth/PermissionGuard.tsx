"use client";

import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PermissionGuardProps {
  /** Single permission or array of permissions (user needs ANY of them) */
  permission: string | string[];
  /** Content to render if user has permission */
  children: ReactNode;
  /** Optional content to render if user lacks permission */
  fallback?: ReactNode;
}

/**
 * Component to conditionally render UI based on user permissions.
 * Use this to hide buttons, sections, or features that require specific permissions.
 * 
 * @example
 * <PermissionGuard permission="MANAGE_USERS">
 *   <button>Delete User</button>
 * </PermissionGuard>
 * 
 * @example
 * <PermissionGuard permission={["MANAGE_USERS", "MANAGE_ROLES"]} fallback={<span>No access</span>}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export const PermissionGuard = ({ 
  permission, 
  children, 
  fallback = null 
}: PermissionGuardProps) => {
  const { hasPermission } = useAuth();
  
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasRequiredPermission = permissions.some(p => hasPermission(p));
  
  return hasRequiredPermission ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;
