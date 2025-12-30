"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Role } from "@/interfaces/IUser";
import { toast } from "sonner";

import ubigeos from "@/utils/json/ubigeos.json";

interface UserFormProps {
  user: User | null;
  onUserSaved: () => void;
}

export default function UserForm({ user, onUserSaved }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([
    { id: "1", name: "ADMIN", description: "Administrador del sistema" },
    { id: "2", name: "VENDEDOR", description: "Personal de ventas" },
    { id: "3", name: "ALMACEN", description: "Personal de almacén" },
  ]);

  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    identityDocument: "",
    phoneNumber: "",
    address: "",
    department: "",
    province: "",
    district: "",
    roleId: "",
    status: true,
  });

  // Ubigeo data logic
  const departments = ubigeos[0].departments;
  const filteredProvinces = departments.find((d) => d.name === formData.department)?.provinces || [];
  const filteredDistricts = filteredProvinces.find((p) => p.name === formData.province)?.districts || [];

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        surname: user.surname || "",
        email: user.email || "",
        identityDocument: user.identityDocument || "",
        phoneNumber: user.phoneNumber || "",
        address: user.address || "",
        department: user.department || "",
        province: user.province || "",
        district: user.district || "",
        roleId: user.role?.id || "",
        status: user.status ?? true,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulación de guardado
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Enviando al back:", formData);
      toast.success(user ? "Usuario actualizado" : "Usuario creado exitosamente");
      onUserSaved();
    } catch (error) {
      toast.error("Error al guardar usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Ej. Juan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">Apellido</Label>
          <Input
            id="surname"
            placeholder="Ej. Pérez"
            value={formData.surname}
            onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="juan.perez@ejemplo.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Teléfono</Label>
          <Input
            id="phoneNumber"
            placeholder="912345678"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="identityDocument">Documento de Identidad</Label>
          <Input
            id="identityDocument"
            placeholder="DNI / RUC"
            value={formData.identityDocument}
            onChange={(e) => setFormData({ ...formData, identityDocument: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Select
            value={formData.roleId}
            onValueChange={(value) => setFormData({ ...formData, roleId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Departamento</Label>
          <Select
            value={formData.department}
            onValueChange={(value) => 
              setFormData({ 
                ...formData, 
                department: value, 
                province: "", 
                district: "" 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Provincia</Label>
          <Select
            value={formData.province}
            onValueChange={(value) => 
              setFormData({ 
                ...formData, 
                province: value, 
                district: "" 
              })
            }
            disabled={!formData.department}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provincia" />
            </SelectTrigger>
            <SelectContent>
              {filteredProvinces.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">Distrito</Label>
          <Select
            value={formData.district}
            onValueChange={(value) => setFormData({ ...formData, district: value })}
            disabled={!formData.province}
          >
            <SelectTrigger>
              <SelectValue placeholder="Distrito" />
            </SelectTrigger>
            <SelectContent>
              {filteredDistricts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección exacte / Referencia</Label>
        <Input
          id="address"
          placeholder="Av. Las Magnolias 123, frente al parque"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" type="button" onClick={() => onUserSaved()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
          {loading ? "Guardando..." : user ? "Actualizar Usuario" : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
