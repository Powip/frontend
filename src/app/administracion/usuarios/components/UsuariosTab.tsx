import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Mail,
  Download,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import NuevoUsuarioModal from "./NuevoUsuarioModal";
import InvitarEmailModal from "./InvitarEmailModal";
import EditarUsuarioModal from "./EditarUsuarioModal";
import { mockUsers, getRoleColor } from "../data";

export default function UsuariosTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
          <div className="text-3xl font-bold mb-1">12</div>
          <div className="text-sm text-slate-500">Total usuarios</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
          <div className="text-3xl font-bold mb-1">10</div>
          <div className="text-sm text-slate-500">Activos ahora</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>
          <div className="text-3xl font-bold mb-1">2</div>
          <div className="text-sm text-slate-500">Inactivos</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
          <div className="text-3xl font-bold mb-1">3</div>
          <div className="text-sm text-slate-500">Roles personalizados</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <NuevoUsuarioModal />
          <InvitarEmailModal />

          <Select defaultValue="todos-roles">
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos-roles">Todos los roles</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="ventas">Ventas</SelectItem>
              <SelectItem value="operaciones">Operaciones</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="contact-center">Contact Center</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="todos-estados">
            <SelectTrigger className=" bg-white">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos-estados">Todos los estados</SelectItem>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="inactivos">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" className="bg-white">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">
                <Checkbox className="rounded bg-white" />
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                USUARIO &uarr;
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                NOMBRE
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                APELLIDOS
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                DIRECCIÓN
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                DISTRITO
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                EMAIL
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                GÉNERO
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                ROLES
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                ESTADO
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                TELÉFONO
              </TableHead>
              <TableHead className="font-semibold text-slate-500 text-xs tracking-wider">
                ACCIONES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUsers.map((u) => (
              <TableRow key={u.id} className="hover:bg-slate-50/50">
                <TableCell className="text-center">
                  <Checkbox className="rounded bg-white" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-medium ${u.color}`}
                    >
                      {u.initials}
                    </div>
                    <span className="font-medium text-slate-900">{u.user}</span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{u.name}</TableCell>
                <TableCell className="text-slate-600">{u.surname}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {u.address}
                </TableCell>
                <TableCell className="text-slate-500">{u.district}</TableCell>
                <TableCell className="text-slate-500 text-sm truncate max-w-[150px]">
                  {u.email}
                </TableCell>
                <TableCell className="text-slate-500">{u.gender}</TableCell>
                <TableCell>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(u.role)}`}
                  >
                    {u.role}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${u.status === "Activo" ? "bg-green-500" : "bg-slate-300"}`}
                    ></div>
                    <span className="text-sm font-medium text-slate-700">
                      {u.status}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-500">{u.phone}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <EditarUsuarioModal user={u}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </EditarUsuarioModal>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Link href={`/administracion/usuarios/${u.id}`}>
                      <Button className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-xs">
                        Resumen
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
          <div className="text-sm text-slate-500">
            Mostrando 1-12 de 12 usuarios
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Select defaultValue="50">
                <SelectTrigger className="h-8 w-[70px] bg-white">
                  <SelectValue placeholder="50" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500">por página</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 p-0"
                disabled
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0 bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:text-white"
              >
                1
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 p-0"
                disabled
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
