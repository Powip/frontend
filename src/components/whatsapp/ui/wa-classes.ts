import { cva } from "class-variance-authority";

export const waButton = cva(
  "inline-flex h-auto items-center justify-center gap-2 whitespace-nowrap border font-medium shadow-none transition-[background-color,border-color,filter] outline-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "border-wa-border focus-visible:border-wa-border bg-wa-surface text-wa-fg hover:border-wa-border-strong hover:bg-wa-surface-2 hover:text-wa-fg dark:bg-wa-surface dark:hover:bg-wa-surface-2",
        primary:
          "border-wa-primary focus-visible:border-wa-primary bg-wa-primary font-semibold text-wa-primary-fg shadow-[0_4px_14px_color-mix(in_srgb,var(--wa-primary)_30%,transparent)] hover:bg-wa-primary-hover hover:text-wa-primary-fg",
        whatsapp:
          "border-wa-whatsapp focus-visible:border-wa-whatsapp bg-wa-whatsapp font-semibold text-white hover:bg-wa-whatsapp hover:text-white hover:brightness-95",
        ghost:
          "border-transparent focus-visible:border-transparent bg-transparent text-wa-fg hover:bg-wa-surface-2 hover:text-wa-fg dark:hover:bg-wa-surface-2",
        danger:
          "border-wa-border focus-visible:border-wa-border bg-wa-surface text-wa-red hover:border-wa-border-strong hover:bg-wa-surface-2 hover:text-wa-red dark:bg-wa-surface",
        "ghost-danger":
          "border-transparent focus-visible:border-transparent bg-transparent text-wa-red hover:bg-wa-surface-2 hover:text-wa-red",
        "solid-danger":
          "border-wa-red focus-visible:border-wa-red bg-wa-red font-semibold text-white hover:bg-wa-red hover:text-white hover:brightness-95",
        facebook:
          "w-full border-transparent focus-visible:border-transparent bg-[#1877F2] py-3 font-semibold text-white hover:bg-[#1877F2] hover:text-white hover:brightness-95",
      },
      size: {
        md: "rounded-[10px] px-4 py-[9px] text-sm has-[>svg]:px-4",
        sm: "rounded-lg px-[11px] py-1.5 text-[13px] has-[>svg]:px-[11px]",
        icon: "size-[34px] rounded-[9px] p-0 has-[>svg]:px-0",
        "icon-lg": "size-11 rounded-[10px] p-0 has-[>svg]:px-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export const waInput =
  "h-auto w-full min-w-0 rounded-[10px] border border-wa-border bg-wa-surface px-3 py-[9px] text-sm text-wa-fg shadow-none outline-none placeholder:text-wa-muted-2 focus-visible:border-wa-primary focus-visible:ring-[3px] focus-visible:ring-wa-primary-soft aria-invalid:border-wa-red disabled:cursor-not-allowed disabled:opacity-60 md:text-sm dark:bg-wa-surface";

export const waSelectTrigger = `${waInput} data-[size=default]:h-auto data-[size=sm]:h-auto data-[placeholder]:text-wa-muted-2 [&_svg]:text-wa-fg [&_svg:not([class*='text-'])]:text-wa-fg dark:hover:bg-wa-surface`;

export const waSelectTriggerSm = `${waSelectTrigger} w-auto px-2 py-1 text-[12.5px]`;

export const waTextarea = `${waInput} min-h-[120px] resize-y leading-[1.55]`;

export const waLabel = "text-[13px] font-medium text-wa-fg";

export const waHint = "text-xs text-wa-muted";

export const waCaps = "text-[11px] font-semibold uppercase tracking-[0.06em] text-wa-muted";

export const waField = "flex min-w-0 flex-col gap-1.5";

export const waStack = "flex flex-col gap-3.5";

export const waRow = "flex flex-wrap items-center gap-2.5";

export const waFieldRow = "grid grid-cols-1 gap-3.5 md:grid-cols-2";

export const waSwitch =
  "h-[23px] w-10 shrink-0 border-0 shadow-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary data-[state=checked]:bg-wa-whatsapp data-[state=unchecked]:bg-wa-border-strong disabled:opacity-45 dark:data-[state=unchecked]:bg-wa-border-strong [&>span]:size-[17px] [&>span]:!bg-white [&>span]:shadow-[0_1px_2px_rgba(0,0,0,0.2)] [&>span[data-state=checked]]:translate-x-[20px] [&>span[data-state=unchecked]]:translate-x-[3px]";

export const waCheckbox =
  "size-4 rounded-[4px] border-wa-border-strong bg-wa-surface shadow-none data-[state=checked]:border-wa-blue data-[state=checked]:bg-wa-blue data-[state=checked]:text-white dark:bg-wa-surface";

export const waRadio =
  "size-4 border-wa-border-strong text-wa-whatsapp-dark shadow-none data-[state=checked]:border-wa-whatsapp-dark [&_svg]:fill-wa-whatsapp-dark";

export const waTableWrap = "relative overflow-x-auto rounded-xl border border-wa-border";

export const waTable = "w-full border-collapse text-[13px]";

export const waTh =
  "h-auto whitespace-nowrap border-b border-wa-border bg-wa-surface-2 px-3.5 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-wa-muted";

export const waTd = "border-b border-wa-border px-3.5 py-[13px] align-middle whitespace-normal";

export const waTr =
  "border-0 hover:bg-transparent data-[state=selected]:bg-transparent [&:last-child>td]:border-b-0";

export const waTrClickable = "cursor-pointer [&:hover>td]:bg-wa-surface-2";

export const waTemplateName = "font-wa-mono text-[12.5px] font-semibold";

export const waSegmented =
  "inline-flex flex-wrap gap-[3px] rounded-[10px] border border-wa-border bg-wa-surface-2 p-[3px]";

export const waSegmentedItem =
  "cursor-pointer rounded-[7px] border-0 bg-transparent px-3 py-1.5 text-[13px] font-medium text-wa-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary aria-checked:bg-wa-surface aria-checked:text-wa-fg aria-checked:shadow-wa aria-pressed:bg-wa-surface aria-pressed:text-wa-fg aria-pressed:shadow-wa aria-selected:bg-wa-surface aria-selected:text-wa-fg aria-selected:shadow-wa disabled:cursor-not-allowed disabled:opacity-50";

export const waFilterChip =
  "hover:bg-wa-surface-2 hover:text-wa-fg focus-visible:border-wa-border has-[>svg]:px-3 inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-wa-border bg-wa-surface px-3 py-[7px] text-[13px] font-medium text-wa-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary aria-pressed:border-wa-fg aria-pressed:bg-wa-surface-2 aria-pressed:text-wa-fg aria-checked:border-wa-fg aria-checked:bg-wa-surface-2 aria-checked:text-wa-fg disabled:cursor-not-allowed disabled:opacity-50";

export const waScopeTag =
  "cursor-pointer rounded-full border border-wa-border bg-wa-surface px-[9px] py-[3px] text-[11.5px] font-medium text-wa-muted outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary aria-pressed:border-wa-teal aria-pressed:bg-wa-teal-soft aria-pressed:text-wa-teal disabled:cursor-not-allowed disabled:opacity-50";

export const waChoice =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-wa-border px-3.5 py-3 has-[[data-state=checked]]:border-wa-whatsapp has-[[data-state=checked]]:bg-wa-whatsapp-soft has-[input:checked]:border-wa-whatsapp has-[input:checked]:bg-wa-whatsapp-soft";

export const waAssistRow =
  "flex flex-wrap items-center gap-3 border-t border-wa-border py-3 first:border-t-0";

export const waDialogContent =
  "wa-ui gap-0 overflow-hidden rounded-[18px] border border-wa-border bg-wa-surface p-0 text-wa-fg shadow-[0_24px_60px_rgba(0,0,0,0.25)]";

export const waDialogHeader =
  "sticky top-0 z-[1] flex flex-row items-center justify-between gap-3 space-y-0 border-b border-wa-border bg-wa-surface px-[22px] py-[18px] text-left";

export const waDialogTitle = "m-0 text-[17px] font-semibold leading-snug text-wa-fg";

export const waDialogBody = "px-[22px] py-[22px]";

export const waDialogFooter =
  "sticky bottom-0 flex flex-row flex-wrap justify-end gap-2.5 border-t border-wa-border bg-wa-surface px-[22px] py-4 sm:justify-end";
