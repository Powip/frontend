"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HeaderConfig } from "@/components/header/HeaderConfig"

export default function RegistrarVentaPage() {
  /* ---------------- Cliente ---------------- */
  const [clientQuery, setClientQuery] = useState("")
  const [clientFound, setClientFound] = useState<any>(null)

  /* ---------------- Productos ---------------- */
  const [stores, setStores] = useState<any[]>([])
  const [inventories, setInventories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState("")
  const [selectedInventory, setSelectedInventory] = useState("")
  const [cart, setCart] = useState<any[]>([])

  /* ---------------- Detalles ---------------- */
  const [gestion, setGestion] = useState("")
  const [canal, setCanal] = useState("")
  const [canalCierre, setCanalCierre] = useState("")
  const [entregaEn, setEntregaEn] = useState("")
  const [enviaPor, setEnviaPor] = useState("")
  const [comentarios, setComentarios] = useState("")

  /* ---------------- Pago ---------------- */
  const [paymentMethod, setPaymentMethod] = useState("")
  const [installments, setInstallments] = useState("")

  /* ---------------- Mock data ---------------- */
  useEffect(() => {
    setStores([{ id: "1", name: "Tienda Central" }])
  }, [])

  useEffect(() => {
    if (!selectedStore) return
    setInventories([{ id: "1", name: "Inventario General" }])
  }, [selectedStore])

  useEffect(() => {
    if (!selectedInventory) return
    setProducts([
      { id: "p1", name: "Zapatillas", price: 120, stock: 10 },
      { id: "p2", name: "Remera", price: 40, stock: 20 },
    ])
  }, [selectedInventory])

  /* ---------------- Actions ---------------- */
  const searchClient = () => {
    setClientFound({
      name: "Juan Pérez",
      dni: "30123456",
      phone: "1122334455",
    })
  }

  const addToCart = (product: any) => {
    setCart((prev) => [...prev, { ...product, quantity: 1 }])
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id))
  }

  /* ---------------- Totales ---------------- */
  const subtotal = cart.reduce((acc, p) => acc + p.price * p.quantity, 0)
  const discount = subtotal * 0.1
  const taxes = subtotal * 0.21
  const total = subtotal - discount + taxes

  const canSubmit =
    clientFound &&
    cart.length > 0 &&
    gestion &&
    canal &&
    canalCierre &&
    entregaEn &&
    enviaPor &&
    paymentMethod

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/ventas">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          </Link>
          <HeaderConfig
            title="Registrar venta"
            description="Carga completa de una venta"
          />
        </div>

        {/* Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="DNI o teléfono"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
              <Button onClick={searchClient}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {clientFound && (
              <div className="border rounded-md p-3">
                <p className="font-medium">{clientFound.name}</p>
                <p className="text-sm text-muted-foreground">
                  DNI {clientFound.dni} • {clientFound.phone}
                </p>
              </div>
            )}

            <Link href="/clientes/create">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Crear cliente
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Select onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tienda" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                onValueChange={setSelectedInventory}
                disabled={!selectedStore}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Inventario" />
                </SelectTrigger>
                <SelectContent>
                  {inventories.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {products.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center border rounded-md p-3"
              >
                <span>{p.name}</span>
                <Button size="sm" onClick={() => addToCart(p)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            ))}

            <div>
              <Label>Carrito</Label>
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between border rounded-md p-2 mt-2"
                >
                  {item.name}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detalles */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la venta</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Select onValueChange={setGestion}>
              <SelectTrigger>
                <SelectValue placeholder="Gestión" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telefonica">Telefónica</SelectItem>
                <SelectItem value="fisica">Física</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setCanal}>
              <SelectTrigger>
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telefono">Teléfono</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setCanalCierre}>
              <SelectTrigger>
                <SelectValue placeholder="Canal de cierre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="web">Web</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setEntregaEn}>
              <SelectTrigger>
                <SelectValue placeholder="Entrega en" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="domicilio">Domicilio</SelectItem>
                <SelectItem value="sucursal">Sucursal</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setEnviaPor}>
              <SelectTrigger>
                <SelectValue placeholder="Envía por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repartidor">Repartidor</SelectItem>
                <SelectItem value="correo">Correo</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              className="md:col-span-2"
              placeholder="Comentarios"
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Cierre */}
        <Card>
          <CardHeader>
            <CardTitle>Cierre de venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>

            {paymentMethod === "tarjeta" && (
              <Select onValueChange={setInstallments}>
                <SelectTrigger>
                  <SelectValue placeholder="Cuotas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 cuota</SelectItem>
                  <SelectItem value="3">3 cuotas</SelectItem>
                  <SelectItem value="6">6 cuotas</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="border-t pt-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Descuento</span>
                <span>-${discount}</span>
              </div>
              <div className="flex justify-between">
                <span>Impuestos</span>
                <span>${taxes}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </div>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={!canSubmit}
            >
              Confirmar venta
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
