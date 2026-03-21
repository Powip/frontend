"use client";

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  UserCheck, 
  Clock,
  Briefcase,
  Mail
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { CreateUserModal } from "./CreateUserModal";
import { UserDetailModal } from "./UserDetailModal";

interface UsersViewProps {
  allUsers: any[];
  auth: any;
  roles: any[];
  companies: any[];
  plans: any[];
  onUpdateSuccess: () => void;
}

const ITEMS_PER_PAGE = 8;

export function UsersView({
  allUsers,
  auth,
  roles,
  companies,
  plans,
  onUpdateSuccess
}: UsersViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // KPIs
  const kpis = useMemo(() => {
    const total = allUsers.length;
    const superadmins = allUsers.filter(u => u.roleName === 'SUPERADMIN').length;
    const companyUsers = allUsers.filter(u => u.companyId).length;
    const last7Days = allUsers.filter(u => {
      const created = new Date(u.createdAt);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return created > sevenDaysAgo;
    }).length;

    return { total, superadmins, companyUsers, last7Days };
  }, [allUsers]);

  // Filtering
  const filteredUsers = useMemo(() => {
    let result = allUsers;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.email?.toLowerCase().includes(lower) || 
        u.name?.toLowerCase().includes(lower) || 
        u.surname?.toLowerCase().includes(lower)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter(u => u.roleName === roleFilter);
    }

    return result;
  }, [allUsers, searchTerm, roleFilter]);

  // Pagination
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard 
          label="Usuarios Totales" 
          value={kpis.total.toString()} 
          sub="En toda la plataforma"
          trend="+12%"
          trendUp={true}
        />
        <KpiCard 
          label="Superadmins" 
          value={kpis.superadmins.toString()} 
          sub="Control total activo"
        />
        <KpiCard 
          label="Empresas" 
          value={kpis.companyUsers.toString()} 
          sub="Admins vinculados"
        />
        <KpiCard 
          label="Nuevos (7d)" 
          value={`+${kpis.last7Days}`} 
          sub="Crecimiento semanal"
          trend="+5"
          trendUp={true}
        />
      </div>

      {/* Main Content */}
      <Card className="bg-[#0f1117] border-white/10 overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-white/5 bg-white/[0.01]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-white">Directorio de Usuarios</CardTitle>
              <CardDescription className="text-gray-400">
                Gestiona permisos, roles y acceso global de la plataforma Powip.
              </CardDescription>
            </div>
            <Button 
              onClick={() => setIsCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white font-bold gap-2"
            >
              <UserPlus className="h-4 w-4" /> Nuevo Usuario
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input 
                placeholder="Buscar por email, nombre o ID..." 
                className="pl-10 bg-white/5 border-white/10 text-white focus:ring-primary/50"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/10 bg-white/5 text-gray-300 gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <select
                className="bg-[#1a1c24] border border-white/10 text-white rounded-md px-3 text-sm focus:outline-none focus:border-primary/50"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los Roles</option>
                {roles.map(r => (
                  <option key={r.id || r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider pl-6">Usuario</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Empresa</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Rol</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Registro</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 font-bold text-xs uppercase group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        {user.name?.[0] || user.email?.[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {user.name ? `${user.name} ${user.surname || ''}` : 'Sin nombre'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.companyId ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                          <Briefcase className="h-3 w-3" />
                        </div>
                        <div className="text-xs text-gray-300 font-mono">
                          {companies.find(c => c.id === user.companyId)?.name || user.companyId.substring(0, 8)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 font-bold italic">PLATAFORMA</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.roleName} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1c24] border-white/10 text-white">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => {
                          setSelectedUser(user);
                          setIsDetailOpen(true);
                        }}>
                          Ver Detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem>Enviar Recup. Contra</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuItem className="text-red-500">Desactivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <Users className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white">No se encontraron usuarios</h3>
              <p className="text-gray-500 text-sm">Prueba con otros términos de búsqueda o filtros.</p>
            </div>
          )}

          <div className="p-6 border-t border-white/5">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>

      <CreateUserModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        auth={auth}
        roles={roles}
        companies={companies}
        plans={plans}
        onSaveSuccess={onUpdateSuccess}
      />

      <UserDetailModal
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        user={selectedUser}
        auth={auth}
        roles={roles}
        companies={companies}
        plans={plans}
        onSaveSuccess={onUpdateSuccess}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, trend, trendUp }: any) {
  return (
    <div className="relative bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 overflow-hidden transition-all hover:shadow-md hover:border-primary/20 group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500 group-hover:text-primary transition-colors">{label}</span>
        {trend && (
          <span className={cn(
            'text-[9px] font-black px-2 py-0.5 rounded-full',
            trendUp ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">{sub}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: any = {
    SUPERADMIN: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    ADMINISTRADOR: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    EDITOR: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    USER: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  return (
    <Badge className={`px-2 py-0.5 text-[9px] font-bold border ${styles[role] || styles.USER}`}>
      {role}
    </Badge>
  );
}
