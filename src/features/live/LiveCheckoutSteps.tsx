const steps = ["Datos y entrega", "Revisar compra", "Pagar con Yape"] as const;

export default function LiveCheckoutSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Pasos de compra" className="pt-3">
      <ol className="grid grid-cols-3 gap-2 text-xs">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index + 1 === step ? "step" : undefined}
            className={`flex min-w-0 items-start gap-2 border-t-2 pt-2 ${index + 1 <= step ? "border-[#25F4EE] text-[#25F4EE]" : "border-white/15 text-zinc-400"}`}
          >
            <span className="font-bold" aria-hidden="true">
              {index + 1}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
