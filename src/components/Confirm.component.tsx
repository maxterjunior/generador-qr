import { useEffect, useRef } from "preact/hooks";

interface ConfirmProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
}

export const Confirm = ({ open, setOpen, onConfirm, title, description, confirmLabel = 'Confirmar' }: ConfirmProps) => {

    const confirmRef = useRef<HTMLButtonElement>(null);

    const close = () => setOpen(false);

    useEffect(() => {
        if (!open) return;
        // El foco arranca en el botón de acción, así el diálogo se puede usar con
        // el teclado sin tener que tabular desde el principio de la página.
        confirmRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    if (!open) return null;

    return (
        // z-50: el footer también es z-10 y, al ir después en el DOM, quedaba
        // dibujado por encima del fondo del modal con sus botones clickeables.
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
            onClick={close}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                // Un clic dentro del diálogo no debe cerrarlo.
                onClick={(e) => e.stopPropagation()}
                class="w-full max-w-xs p-4 text-gray-500 bg-white rounded-lg shadow dark:bg-gray-800 dark:text-gray-400">
                <div class="flex">
                    <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-yellow-500 bg-blue-100 rounded-lg dark:text-yellow-300 dark:bg-yellow-900">
                        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z" />
                        </svg>
                    </div>
                    <div class="ms-3 text-sm font-normal">
                        <span id="confirm-title" class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {title}
                        </span>
                        {description ? <div class="mb-2 text-sm font-normal">{description}</div> : null}
                        <div class="grid grid-cols-1 gap-2">
                            <div>
                                <button
                                    ref={confirmRef}
                                    onClick={() => { close(); onConfirm() }}
                                    class="inline-flex justify-center w-full px-2 py-1.5 text-xs font-medium text-center text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800">
                                    {confirmLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={close}
                        type="button" class="ms-auto -mx-1.5 -my-1.5 bg-white items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Cerrar">
                        <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
