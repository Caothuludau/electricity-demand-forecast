import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type RangePreset = 24 | 168 | 720 | "custom";

export function TimeRangeSelector({
  value,
  onChange,
  disabled,
}: {
  value: RangePreset;
  onChange: (value: RangePreset) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const options: { value: RangePreset; label: string }[] = [
    { value: 24, label: t("fc.range24h") },
    { value: 168, label: t("fc.range7d") },
    { value: 720, label: t("fc.range30d") },
  ];
  return (
    <div className="flex items-center gap-1 rounded border border-border bg-surface p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
            value === opt.value
              ? "bg-surface-2 text-text-primary"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
