import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-6xl font-bold text-blue-600 mb-8">Home</h1>
      <div className="flex direction-col space-x-6">
        <Link href="/ventas" className="text-blue-500 hover:underline text-xl">
          Ventas
        </Link>
        <Link href="/pedidos" className="text-blue-500 hover:underline text-xl">
          Pedidos
        </Link>
        <Link href="/productos" className="text-blue-500 hover:underline text-xl">
          Productos
        </Link>
      </div>
    </div>
  );
}