import Link from "next/link";

export default function Pedidos() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-green mb-8">Pedidos</h1>
      <Link href="/" className="text-blue-500 hover:underline text-xl">
        Volver a Home
      </Link>
    </div>
  );
}