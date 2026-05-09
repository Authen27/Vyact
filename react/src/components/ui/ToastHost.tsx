import { useStore } from '../../store';

export default function ToastHost() {
  const toasts = useStore(s => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2 max-w-xs">
      {toasts.map(t => {
        const accent = t.type === 'success' ? 'border-l-sage'
                     : t.type === 'error'   ? 'border-l-terra'
                     : t.type === 'warning' ? 'border-l-honey'
                     :                         'border-l-denim';
        return (
          <div
            key={t.id}
            className={`bg-bg2 border border-line2 ${accent} border-l-[3px] text-ink px-4 py-3 rounded-md font-mono text-[0.7rem] tracking-wide shadow-2 animate-toastIn`}
          >
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
