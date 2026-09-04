import { useEffect, useRef } from "preact/hooks";

interface ConfirmProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    /** Lo que se va a perder, mostrado como una etiqueta impresa. */
    item?: { name: string; detail?: string };
    confirmLabel?: string;
    cancelLabel?: string;
}

/**
 * Marca de posición de un QR (los cuadrados de las esquinas). Se usa como glifo
 * del diálogo en vez de un ícono de alerta genérico: es el artefacto más
 * reconocible de lo que hace esta app.
 */
const FinderPattern = () => (
    <svg viewBox="0 0 21 21" fill="none" aria-hidden="true" class="w-[18px] h-[18px]">
        <rect x="1.5" y="1.5" width="18" height="18" stroke="currentColor" stroke-width="3" />
        <rect x="6" y="6" width="9" height="9" fill="currentColor" />
    </svg>
);

export const Confirm = ({
    open, setOpen, onConfirm, title, description, item,
    confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
}: ConfirmProps) => {

    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const close = () => setOpen(false);

    useEffect(() => {
        if (!open) return;

        // El foco arranca en Cancelar, no en la acción destructiva: así un Enter
        // reflejo al abrirse no borra nada.
        cancelRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') return close();
            if (e.key !== 'Tab') return;
            // Trampa de foco: el tabulador no debe escaparse al resto de la página
            // mientras el diálogo está abierto.
            const items = dialogRef.current?.querySelectorAll<HTMLElement>('button');
            if (!items?.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    if (!open) return null;

    return (
        // z-50: el footer es z-10 y, al ir después en el DOM, quedaba dibujado por
        // encima del fondo del modal con sus botones clickeables.
        <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none dark:bg-black/70"
            onClick={close}>
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby={description ? 'confirm-description' : undefined}
                onClick={(e) => e.stopPropagation()}
                class="w-full max-w-sm overflow-hidden bg-white border shadow-2xl rounded-xl border-zinc-200 animate-dialog-in motion-reduce:animate-none dark:bg-[#1f1f1f] dark:border-white/10">

                <div class="p-5">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center justify-center flex-shrink-0 rounded-lg w-9 h-9 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                            <FinderPattern />
                        </span>
                        <h2 id="confirm-title" class="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
                            {title}
                        </h2>
                    </div>

                    {description ?
                        <p id="confirm-description" class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {description}
                        </p>
                        : null}

                    {item ?
                        // Ficha del elemento afectado, con el borde perforado de una
                        // etiqueta impresa: muestra exactamente qué se pierde.
                        <div class="flex items-baseline gap-3 px-3 py-2 mt-4 border-l-2 border-dashed rounded-r-md bg-zinc-100 border-zinc-400 dark:bg-white/5 dark:border-zinc-500">
                            <span class="font-mono text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">
                                {item.name}
                            </span>
                            {item.detail ?
                                <span class="flex-shrink-0 ml-auto text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                    {item.detail}
                                </span>
                                : null}
                        </div>
                        : null}
                </div>

                <div class="flex justify-end gap-2 px-5 py-3 border-t bg-zinc-50 border-zinc-200 dark:bg-white/[0.02] dark:border-white/10">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={close}
                        class="px-3 py-1.5 text-sm font-medium rounded-lg text-zinc-700 hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-white/10 dark:focus-visible:ring-zinc-500">
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => { close(); onConfirm() }}
                        class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1f1f1f]">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
