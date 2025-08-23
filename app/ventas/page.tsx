import Link from "next/link";

export default function Ventas() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-8">Ventas</h1>
      <Link href="/" className="text-blue-500 hover:underline text-xl">
        Volver a Home
      </Link>
    </div>
  );
}