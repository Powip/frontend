"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import Label from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------
    INTERFACES
------------------------------------------- */

interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  address: string;
  district: string;
  phoneNumber: string;
}

/* ------------------------------------------
    PAGE COMPONENT
------------------------------------------- */

export default function DatosPersonalesPage() {
    const { auth, logout } = useAuth();
  const userId = auth?.user.id;
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingChanges, setSavingChanges] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* -- Password fields -- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* ------------------------------------------
      FETCH USER DATA
  ------------------------------------------- */

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        const res = await axios.get(`http://localhost:8080/api/v1/auth/user/${userId}`);
        setUser(res.data);
        console.log(res.data);
      } catch (error) {
        console.error(error);
        toast.error("Error al cargar los datos del usuario.");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchData();
  }, [userId, BASE_URL]);

  /* ------------------------------------------
      HANDLE UPDATE USER
  ------------------------------------------- */

  const handleSaveChanges = async () => {
    if (!user) return;

    setSavingChanges(true);

    try {
      await axios.put(`http://localhost:8080/api/v1/auth/user/${userId}`, {
        name: user.name,
        surname: user.surname,
        address: user.address,
        district: user.district,
        phoneNumber: user.phoneNumber,
      });

      toast.success("Datos actualizados con éxito");
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron actualizar los datos");
    } finally {
      setSavingChanges(false);
    }
  };

  /* ------------------------------------------
      HANDLE RESET PASSWORD
  ------------------------------------------- */

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setChangingPassword(true);

    try {
      await axios.post(`http://localhost:8080/api/v1/auth/update-password`, {
        userId,
        currentPassword,
        newPassword,
      });

      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      toast.error("Error al cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="animate-pulse text-gray-500">Cargando datos...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p>No se encontraron datos del usuario.</p>
      </div>
    );
  }

  /* ------------------------------------------
      RENDER
  ------------------------------------------- */

  return (
    <div className="flex min-h-screen">
      

      <main className=" flex-1 p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/configuracion">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>

          
        </div>

        {/* Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle>Información de perfil</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={user.surname}
                  onChange={(e) => setUser({ ...user, surname: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email} disabled className="bg-gray-100" />
              </div>

              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={user.address}
                  onChange={(e) => setUser({ ...user, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Distrito</Label>
                <Input
                  value={user.district}
                  onChange={(e) => setUser({ ...user, district: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={user.phoneNumber}
                  onChange={(e) => setUser({ ...user, phoneNumber: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle>Seguridad</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contraseña actual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Confirmar contraseña</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={handlePasswordChange}
                disabled={changingPassword}
              >
                {changingPassword ? "Actualizando..." : "Cambiar contraseña"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Save changes */}
        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSaveChanges}
            disabled={savingChanges}
          >
            {savingChanges ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </main>
    </div>
  );
}
