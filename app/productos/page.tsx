import Catalogo from "@/src/components/products/Catalogo";
import Link from "next/link";

export default function Productos() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Catalogo/>
    </div>
  );
}