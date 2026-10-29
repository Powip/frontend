import {
  MONTHLY_ORDER_VOLUME_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  type BusinessQuestionAnswers,
  type MonthlyOrderVolume,
} from "@/lib/onboardingQuestions";

interface BusinessQuestionsProps extends BusinessQuestionAnswers {
  onSalesChannelsChange: (channels: string[]) => void;
  onMonthlyOrderVolumeChange: (volume: MonthlyOrderVolume) => void;
  errors: Partial<Record<keyof BusinessQuestionAnswers, string>>;
  disabled?: boolean;
}

const choiceClassName =
  "block rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors peer-checked:border-[#4F3A96] peer-checked:bg-[#f0ebfb] peer-checked:text-[#4F3A96] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#4F3A96] peer-disabled:cursor-not-allowed peer-disabled:opacity-60 sm:text-base";

export function BusinessQuestions({
  salesChannels,
  monthlyOrderVolume,
  onSalesChannelsChange,
  onMonthlyOrderVolumeChange,
  errors,
  disabled = false,
}: BusinessQuestionsProps) {
  return (
    <div className="space-y-7">
      <fieldset
        disabled={disabled}
        aria-describedby={`sales-channels-hint${errors.salesChannels ? " sales-channels-error" : ""}`}
      >
        <legend className="text-base font-bold text-gray-900">
          ¿Por dónde vendes? <span className="text-red-500">*</span>
        </legend>
        <p id="sales-channels-hint" className="mb-3 mt-1 text-sm text-gray-500">
          Marca todos los que uses. Obligatorio.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {SALES_CHANNEL_OPTIONS.map((channel) => (
            <label key={channel} className="max-w-full cursor-pointer">
              <input
                type="checkbox"
                name="sales_channels"
                value={channel}
                checked={salesChannels.includes(channel)}
                onChange={(event) =>
                  onSalesChannelsChange(
                    event.target.checked
                      ? [...salesChannels, channel]
                      : salesChannels.filter((selected) => selected !== channel),
                  )
                }
                aria-invalid={Boolean(errors.salesChannels)}
                aria-describedby={errors.salesChannels ? "sales-channels-error" : undefined}
                className="peer sr-only"
              />
              <span className={choiceClassName}>{channel}</span>
            </label>
          ))}
        </div>
        {errors.salesChannels && (
          <p id="sales-channels-error" role="alert" className="mt-2 text-sm text-red-600">
            {errors.salesChannels}
          </p>
        )}
      </fieldset>

      <fieldset
        disabled={disabled}
        aria-describedby={`monthly-volume-hint${errors.monthlyOrderVolume ? " monthly-volume-error" : ""}`}
      >
        <legend className="text-base font-bold text-gray-900">
          ¿Cuántos pedidos despachas al mes? <span className="text-red-500">*</span>
        </legend>
        <p id="monthly-volume-hint" className="mb-3 mt-1 text-sm text-gray-500">
          Selecciona una opción. Obligatorio.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {MONTHLY_ORDER_VOLUME_OPTIONS.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="monthly_order_volume"
                value={option.value}
                checked={monthlyOrderVolume === option.value}
                onChange={() => onMonthlyOrderVolumeChange(option.value)}
                aria-invalid={Boolean(errors.monthlyOrderVolume)}
                aria-describedby={errors.monthlyOrderVolume ? "monthly-volume-error" : undefined}
                className="peer sr-only"
              />
              <span className={choiceClassName}>{option.label}</span>
            </label>
          ))}
        </div>
        {errors.monthlyOrderVolume && (
          <p id="monthly-volume-error" role="alert" className="mt-2 text-sm text-red-600">
            {errors.monthlyOrderVolume}
          </p>
        )}
      </fieldset>
    </div>
  );
}
