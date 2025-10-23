import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-green mb-8">Home</h1>
      <div className="flex direction-col space-x-6">
        <Link href="/ventas" className="text-blue-500 hover:underline text-xl">
          Ventas
        </Link>
        <Link href="/pedidos" className="text-blue-500 hover:underline text-xl">
          Pedidos
        </Link>
        <Link
          href="/productos"
          className="text-blue-500 hover:underline text-xl"
        >
          Productos
        </Link>
        <Link href="/login" className="text-blue-500 hover:underline text-xl">
          Login
        </Link>
      </div>
    </div>
  );
}
