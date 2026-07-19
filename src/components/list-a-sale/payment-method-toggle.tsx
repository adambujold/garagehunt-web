import type { PaymentMethod } from '@/lib/sale-listings-write';

export function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  const options: { value: PaymentMethod; label: string }[] = [
    { value: 'cash_only', label: 'Cash only' },
    { value: 'cash_and_etransfer', label: 'Cash + e-Transfer' },
  ];

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full border-2 px-3 py-2 text-sm font-medium transition ${
            value === option.value
              ? 'border-coral bg-coral text-paper'
              : 'border-tan-border bg-white text-ink hover:border-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
