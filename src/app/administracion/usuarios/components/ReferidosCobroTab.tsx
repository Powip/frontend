import { useState } from "react";
import {
  HelpCircle,
  Copy,
  Landmark,
  Heart,
  Plus,
  CreditCard,
} from "lucide-react";

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

export default function ReferidosCobroTab() {
  const [rewardType, setRewardType] = useState<"descuento" | "efectivo">(
    "efectivo",
  );

  const [selectedBank, setSelectedBank] = useState("bcp");

  const banks = [
    {
      id: "bcp",
      name: "BCP",
      icon: <Landmark className="w-5 h-5 text-slate-400" />,
    },
    {
      id: "interbank",
      name: "Interbank",
      icon: <Landmark className="w-5 h-5 text-emerald-600" />,
    },
    {
      id: "bbva",
      name: "BBVA",
      icon: <Landmark className="w-5 h-5 text-blue-600" />,
    },
    {
      id: "scotiabank",
      name: "Scotiabank",
      icon: <Landmark className="w-5 h-5 text-red-500" />,
    },
    {
      id: "yape",
      name: "Yape",
      icon: <Heart className="w-5 h-5 text-purple-600 fill-purple-600" />,
    },
    {
      id: "plin",
      name: "Plin",
      icon: <Heart className="w-5 h-5 text-emerald-500 fill-emerald-500" />,
    },
    {
      id: "nacion",
      name: "Nación",
      icon: <Landmark className="w-5 h-5 text-slate-500" />,
    },
    {
      id: "otro",
      name: "Otro",
      icon: <Plus className="w-5 h-5 text-indigo-600" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <HelpCircle className="w-5 h-5 text-slate-400" />

          <h3 className="font-semibold text-slate-900">
            ¿Cómo funciona el cobro de referidos?
          </h3>
        </div>

        <div className="relative flex justify-between mb-10 max-w-4xl mx-auto">
          <div className="absolute top-5 left-0 w-full h-[2px] bg-slate-200 -z-10"></div>

          <div className="absolute top-5 left-0 w-[80%] h-[2px] bg-emerald-800 -z-10"></div>

          <div className="flex flex-col items-center text-center w-1/4 px-2">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-bold mb-3">
              1
            </div>

            <h4 className="font-semibold text-sm mb-1">Compartes tu link</h4>

            <p className="text-xs text-slate-500">
              Link único generado de tu empresa
            </p>
          </div>

          <div className="flex flex-col items-center text-center w-1/4 px-2">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-bold mb-3">
              2
            </div>

            <h4 className="font-semibold text-sm mb-1">Se activa el plan</h4>

            <p className="text-xs text-slate-500">
              Tu referido activa cualquier plan de pago
            </p>
          </div>

          <div className="flex flex-col items-center text-center w-1/4 px-2">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-bold mb-3">
              3
            </div>

            <h4 className="font-semibold text-sm mb-1">Powip confirma</h4>

            <p className="text-xs text-slate-500">
              Verificamos el pago dentro de 24h
            </p>
          </div>

          <div className="flex flex-col items-center text-center w-1/4 px-2">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-bold mb-3">
              4
            </div>

            <h4 className="font-semibold text-sm mb-1">
              Recibes tu recompensa
            </h4>

            <p className="text-xs text-slate-500">
              El 1ro de cada mes se procesan todos los abonos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => setRewardType("descuento")}
            className={`text-left rounded-xl border p-5 shadow-sm transition-all ${
              rewardType === "descuento"
                ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500"
                : "border-slate-200 bg-white hover:border-indigo-300"
            }`}
          >
            <div className="text-2xl mb-3">💰</div>

            <h4 className="font-semibold text-slate-900 mb-2">
              Descuento en tu suscripción
            </h4>

            <p className="text-sm text-slate-500 mb-4">
              Descuento permanente acumulable. Si tienes 3 referidos activos,
              ese descuento se mantiene mientras ellos estén suscritos.
            </p>

            <div className="text-lg font-bold text-emerald-600">
              10% OFF por referido
            </div>
          </button>

          <button
            onClick={() => setRewardType("efectivo")}
            className={`text-left rounded-xl border p-5 shadow-sm transition-all ${
              rewardType === "efectivo"
                ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500"
                : "border-slate-200 bg-white hover:border-indigo-300"
            }`}
          >
            <div className="text-2xl mb-3">🎁</div>

            <h4 className="font-semibold text-slate-900 mb-2">
              Monto en efectivo — necesita cuenta bancaria
            </h4>

            <p className="text-sm text-slate-500 mb-4">
              S/50 por cada referido que active un plan. Se acumula y el abono
              se hace el 1ro de cada mes a tu cuenta registrada.
            </p>

            <div className="text-lg font-bold text-indigo-700">
              S/ 50 por referido activado
            </div>
          </button>
        </div>

        {rewardType === "efectivo" && (
          <div className="border-t border-slate-200 pt-8 mt-4">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">📋</span>

                <h3 className="font-semibold text-slate-900">
                  Proceso de cobro en efectivo
                </h3>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Registras tu cuenta bancaria
                    </h4>

                    <p className="text-xs text-slate-500">
                      BCP, Interbank, BBVA, Scotiabank, Yape o Plin. Solo
                      necesitas el número de cuenta o número de celular.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Se activa un referido
                    </h4>

                    <p className="text-xs text-slate-500 mb-2">
                      Powip detecta que alguien usó tu link y activó un plan de
                      pago. Recibes notificación por WhatsApp.
                    </p>

                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-200">
                      Notificación automática por WA
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Esperas hasta el 1ro del mes
                    </h4>

                    <p className="text-xs text-slate-500">
                      Todos los referidos del mes anterior se procesan juntos
                      para hacer un solo abono.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    4
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Powip hace el abono
                    </h4>

                    <p className="text-xs text-slate-500 mb-2">
                      Transferencia bancaria directa o depósito en Yape/Plin
                      según lo que hayas registrado. Mínimo para cobrar: S/50
                    </p>

                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-200">
                      Confirmación por email y WA
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-indigo-600">
                  <CreditCard className="w-5 h-5" />
                </span>

                <h3 className="font-semibold text-indigo-900">
                  Registrar cuenta para recibir pagos
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                      selectedBank === bank.id
                        ? "border-indigo-600 bg-white shadow-sm ring-1 ring-indigo-600"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="mb-2">{bank.icon}</div>

                    <span className="text-xs font-bold text-slate-700">
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>

              {(selectedBank === "yape" || selectedBank === "plin") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Número de celular *
                    </Label>

                    <Input
                      placeholder="Ej: 987654321"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Titular de la cuenta *
                    </Label>

                    <Input
                      placeholder="Nombre completo"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      DNI del titular *
                    </Label>

                    <Input
                      placeholder="Número de documento"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Email de confirmación
                    </Label>

                    <Input
                      placeholder="para notificarte el abono"
                      className="bg-white h-11"
                    />
                  </div>
                </div>
              )}

              {selectedBank !== "yape" && selectedBank !== "plin" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Número de cuenta *
                    </Label>

                    <Input
                      placeholder="Ej: 191-12345678-0-01"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Tipo de cuenta
                    </Label>

                    <Select defaultValue="ahorros">
                      <SelectTrigger className="bg-white h-11">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="ahorros">
                          Cuenta de ahorros
                        </SelectItem>

                        <SelectItem value="corriente">
                          Cuenta corriente
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Titular de la cuenta *
                    </Label>

                    <Input
                      placeholder="Nombre completo o razón social"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      DNI / RUC del titular
                    </Label>

                    <Input
                      placeholder="Número de documento"
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      CCI (Cuenta interbancaria)
                    </Label>

                    <Input
                      placeholder="002-191-..."
                      className="bg-white h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Email de confirmación
                    </Label>

                    <Input
                      placeholder="para notificarte el abono"
                      className="bg-white h-11"
                    />
                  </div>
                </div>
              )}

              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                Guardar cuenta bancaria
              </Button>

              <p className="text-center text-xs text-slate-500 mt-4">
                Tus datos bancarios están cifrados y solo se usan para procesar
                los pagos de referidos
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>

            <h3 className="font-semibold text-slate-900">
              Tus estadísticas de referidos
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <div className="text-2xl font-bold text-slate-900 mb-1">0</div>

            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Referidos activos
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <div className="text-2xl font-bold text-emerald-600 mb-1">S/ 0</div>

            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Ganado este mes
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <div className="text-2xl font-bold text-emerald-600 mb-1">S/ 0</div>

            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Total histórico
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <div className="text-2xl font-bold text-slate-900 mb-1">0%</div>

            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Descuento acumulado
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-3">
            Tu link de referido
          </h4>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <Input
              readOnly
              value="powip.lat/ref/aranni2024"
              className="bg-slate-50 border-slate-200 text-slate-500 flex-1 h-11"
            />

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button className="bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none h-11 px-6">
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>

              <Button className="bg-emerald-500 hover:bg-emerald-600 flex-1 sm:flex-none text-white border-transparent h-11 px-6">
                Compartir WA
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50/50 rounded-lg p-4 text-center text-sm text-slate-600 border border-indigo-100">
        Aún no tienes referidos activos. Comparte tu link y empieza a ganar 🚀
      </div>
    </div>
  );
}
