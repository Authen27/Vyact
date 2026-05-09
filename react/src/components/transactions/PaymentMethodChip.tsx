import { PAYMENT_METHODS } from '../../constants';

interface Props { id?: string; size?: number; }

export default function PaymentMethodChip({ id, size = 28 }: Props) {
  if (!id) return null;
  const pm = PAYMENT_METHODS[id];
  if (!pm) return null;
  return (
    <span
      title={pm.name}
      className="inline-flex items-center justify-center font-mono text-[0.62rem] font-bold flex-shrink-0 shadow-1"
      style={{
        width: size, height: size,
        borderRadius: 6,
        background: pm.color,
        color: '#fff',
        textShadow: '0 1px 1px rgba(0,0,0,.15)',
      }}
    >
      {pm.abbr}
    </span>
  );
}
