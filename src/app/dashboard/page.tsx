"use client";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";

export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Stats />
      </div>
    </div>
  );
}
