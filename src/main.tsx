import { signal, type Signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import QR from "qrcode";
import Editable from "./components/editable";
import { QrIcon } from "./components/icons/qr";
import "./index.css";
import QrScanner from "qr-scanner";
import { Confirm } from "./components/Confirm.component";
import ZebraBrowserPrintWrapper from "zebra-browser-print-wrapper";


// Migra a preact
interface Tab {
    id: string;
    name: string;
    input: string;
    values: string[];
}

// Identidad estable de la pestaña: sirve de `key` en el render y de referencia
// para borrar/renombrar, en lugar de un índice que se corre al mutar la lista.
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// El texto lo escribe el usuario y termina dentro de un document.write: sin
// escapar, un valor con `</p><script>` se ejecuta y cualquier `<` o `&` rompe
// el layout de la impresión.
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// En ZPL `^` y `~` abren comandos, y `\` es el indicador hexadecimal que activa
// `^FH\`: dentro de un ^FD rompen la etiqueta. ^FH permite escribirlos como \XX.
// Sólo se activa cuando hace falta, para que las etiquetas sin estos caracteres
// generen exactamente el mismo ZPL que antes.
export const zplSpecial = /[\^~\\]/;
export const escapeZpl = (text: string) => text.replace(/[\^~\\]/g, c => '\\' + c.charCodeAt(0).toString(16).toUpperCase());

const cacheIndexKey = 'index-tab';
const cacheTabsKey = 'tabs-qr';
const cacheSelectedKey = 'qrs-selected';
const cacheSelectedKeyAlter = 'qrs-selected-alter';

const indexTab = signal(-1);

const tabs = signal<Tab[]>([]);
// Única definición del criterio de separación; estaba repetido en el onInput del
// textarea, en el listener del evento y en readQr. Además recorta ANTES de
// filtrar: al revés, una línea con sólo espacios pasaba el filtro y quedaba como
// un valor vacío, con el que no se puede generar ningún QR.
const splitValues = (input: string, byLine: boolean) =>
    input.split(byLine ? '\n' : /\s/).map(v => v.trim()).filter(v => v);

// Preferencias persistidas. Antes convivían un `useLocalStorage` en ButtonsAccion
// y una copia con `useState` en TextArea, sincronizadas a mano con un CustomEvent
// 'renderQrs' sobre el document: dos fuentes de verdad para el mismo dato.
const typeSplitKey = 'typeSplit';   // false = separa por /\s/, true = por \n
const enableHoverKey = 'enableHover';
const enableDualCheckKey = 'enableDualCheck';

const readFlag = (key: string) => localStorage.getItem(key) === 'true';

const typeSplitSignal = signal(readFlag(typeSplitKey));
const enableHoverSignal = signal(readFlag(enableHoverKey));
const enableDualCheckSignal = signal(readFlag(enableDualCheckKey));

const setFlag = (sig: Signal<boolean>, key: string, value: boolean) => {
    sig.value = value;
    localStorage.setItem(key, JSON.stringify(value));
}

// Cambiar el separador sí obliga a recalcular los valores de todas las pestañas.
// Los otros dos toggles son sólo de estilo y ya no disparan ese recálculo (antes
// los tres emitían 'renderQrs' y reescribían localStorage en cada clic).
const setTypeSplit = (byLine: boolean) => {
    setFlag(typeSplitSignal, typeSplitKey, byLine);
    for (const tab of tabs.value) tab.values = splitValues(tab.input, byLine);
    tabs.value = [...tabs.value];
}

// Las selecciones se guardan por pestaña (`{ [tabId]: string[] }`). Antes eran
// un set plano de textos: seleccionar un QR en una pestaña lo marcaba en
// cualquier otra que tuviera el mismo texto, y nada se borraba nunca.
type SelectionMap = Record<string, string[]>;

const readSelections = (key: string): SelectionMap => {
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '{}');
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch (error) {
        console.error('Selección guardada ilegible', error);
        return {};
    }
}

const selections = signal<SelectionMap>(readSelections(cacheSelectedKey));
const selectionsAlter = signal<SelectionMap>(readSelections(cacheSelectedKeyAlter));

const selectedOf = (map: SelectionMap, tab?: Tab) => new Set(tab ? map[tab.id] ?? [] : []);

const writeSelections = (key: string, sig: typeof selections, tab: Tab, values: Set<string>) => {
    const next = { ...sig.value };
    if (values.size) next[tab.id] = Array.from(values);
    else delete next[tab.id];
    sig.value = next;
    localStorage.setItem(key, JSON.stringify(next));
}

// Al borrar una pestaña se van también sus selecciones, que si no quedaban
// acumulándose en localStorage para siempre.
const dropSelectionsOf = (tab: Tab) => {
    for (const [key, sig] of [[cacheSelectedKey, selections], [cacheSelectedKeyAlter, selectionsAlter]] as const) {
        if (!(tab.id in sig.value)) continue;
        const next = { ...sig.value };
        delete next[tab.id];
        sig.value = next;
        localStorage.setItem(key, JSON.stringify(next));
    }
}

// Único punto que mueve la pestaña activa: siempre persiste el índice para
// que no quede desincronizado con las pestañas guardadas al recargar.
const setIndexTab = (index: number) => {
    indexTab.value = index;
    localStorage.setItem(cacheIndexKey, index.toString());
}

const addTab = () => {
    const tab: Tab = { id: newId(), name: `Tab ${tabs.value.length + 1}`, input: '', values: [] }
    tabs.value = [...tabs.value, tab];
    setIndexTab(tabs.value.length - 1);
}

const deleteTab = (id: string) => {
    const index = tabs.value.findIndex(t => t.id === id);
    if (index < 0) return;
    dropSelectionsOf(tabs.value[index]);
    tabs.value = tabs.value.filter(t => t.id !== id);
    // Nunca dejar la app sin pestaña activa: sin ella el textarea escribía
    // sobre undefined y la app quedaba inutilizable hasta recargar.
    if (!tabs.value.length) return addTab();
    setIndexTab(Math.min(index, tabs.value.length - 1));
}

const renameTab = (id: string, name: string) => {
    // Se busca por id y no por índice: el índice capturado en el closure del
    // render puede apuntar a otra pestaña -o a ninguna- cuando llega el blur.
    const tab = tabs.value.find(t => t.id === id);
    if (!tab || tab.name === name) return;
    tab.name = name;
    tabs.value = [...tabs.value];
}

const selectTab = (index: number) => {
    if (index < 0 || index >= tabs.value.length) return;
    setIndexTab(index);
}

// Se ejecuta antes de suscribirse a `tabs`: la suscripción se dispara de
// inmediato y, si corriera primero, pisaría el cache con [].
const restoreTabs = () => {
    try {
        const cache = JSON.parse(localStorage.getItem(cacheTabsKey) || '[]');
        if (Array.isArray(cache) && cache.length) {
            // pestañas guardadas antes de que existiera el id
            for (const tab of cache) tab.id ??= newId();
            tabs.value = cache;
            const index = parseInt(localStorage.getItem(cacheIndexKey) || '0');
            // Un índice guardado fuera de rango dejaba indexTab en -1: sin
            // pestaña activa, UI en blanco y crash al escribir.
            setIndexTab(Number.isNaN(index) ? 0 : Math.min(Math.max(index, 0), tabs.value.length - 1));
            return;
        }
    } catch (error) {
        console.error("Error al obtener valores anteriores", error);
    }
    addTab();
}


const HeaderTab = () => {

    const scrollRef = useRef<any>(null);


    const handler = () => {
        addTab()
        setTimeout(() => {
            scrollRef.current.scrollLeft = scrollRef?.current?.scrollWidth;
        }, 1)
    }

    const [confirm, setConfirm] = useState(false);
    const [selected, setSelected] = useState<{ id: string, name: string, count: number }>();

    const confirmDeleteTab = (tab: Tab) => {
        setSelected({ id: tab.id, name: tab.name, count: tab.values.length });
        setConfirm(true);
    }

    return <>
        <Confirm
            title="Eliminar la pestaña"
            description="Se borra la pestaña con todo su contenido. No se puede deshacer."
            item={selected ? {
                name: selected.name,
                detail: `${selected.count} ${selected.count === 1 ? 'código' : 'códigos'}`,
            } : undefined}
            confirmLabel="Eliminar pestaña"
            // Sin pestaña elegida no se borra nada: antes `selected?.i || 0`
            // caía en el índice 0 y borraba la primera.
            onConfirm={() => selected && deleteTab(selected.id)}
            open={confirm}
            setOpen={setConfirm}
        />
        <div class="sticky top-0 z-20 flex items-stretch w-full bg-white border-b border-gray-200 dark:bg-[#242424] dark:border-white/10">
            {/* La tira de pestañas se desplaza sola y el botón de nueva pestaña
                queda fuera de ella, siempre a la vista. Antes era un `absolute`
                sin ancestro posicionado: se anclaba al documento, así que en el
                teléfono se iba con el scroll y tapaba la última pestaña. */}
            <div class="flex-1 min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain tabs-scroll" ref={scrollRef}>
                <ul class="flex items-center gap-1 px-1 text-sm font-medium sm:gap-4 min-h-[52px]">
                    {
                        tabs.value.map((t, i) =>
                            <li key={t.id} class="flex-1 min-w-[10.5rem] sm:min-w-[250px] max-w-[450px]">
                                <span
                                    className={`cursor-pointer relative w-full text-center flex items-center justify-center gap-1 sm:gap-2 px-1 py-2 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-full ${indexTab.value === i ? 'text-blue-700 dark:text-blue-500 after:bg-blue-700 hover:text-blue-700 font-bold' : 'hover:after:bg-blue-400  dark:text-white'}`}
                                    onClick={() => selectTab(i)}
                                >
                                    {/* Sólo la pestaña activa se puede renombrar. Con el
                                        contentEditable siempre encendido, en un teléfono cada
                                        toque para cambiar de lote abría el teclado. */}
                                    <Editable
                                        text={t.name}
                                        editable={indexTab.value === i}
                                        onChange={(value) => renameTab(t.id, value)}
                                        className="flex-1 min-w-0 px-1 truncate rounded-sm outline-none focus:bg-black/5 dark:focus:bg-white/10"
                                    />

                                    {/* Cuántos códigos tiene la pestaña. Se omite en las
                                        vacías: un 0 es ruido, no información. */}
                                    {t.values.length ?
                                        <span
                                            aria-label={`${t.values.length} ${t.values.length === 1 ? 'código' : 'códigos'}`}
                                            class="flex-shrink-0 rounded px-1.5 py-px text-[11px] font-medium tabular-nums bg-black/10 text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                            {t.values.length}
                                        </span>
                                        : null}

                                    <button onClick={() => confirmDeleteTab(t)} type="button" class="flex-shrink-0 inline-flex items-center justify-center p-2 text-gray-400 rounded-md hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-white/10">
                                        <span class="sr-only">Eliminar la pestaña {t.name}</span>
                                        <svg class="w-5 h-5 sm:h-6 sm:w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            </li>
                        )
                    }
                </ul>
            </div>
            <button onClick={handler} type="button" title="Nueva pestaña" class="inline-flex items-center self-stretch flex-shrink-0 px-4 text-gray-400 border-l border-gray-200 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-white/10 dark:hover:bg-white/10">
                <span class="sr-only">Nueva pestaña</span>
                <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>
    </>
}

const TextArea = () => {

    const ref = useRef<HTMLTextAreaElement>(null);

    const maxHeight = 200;

    // Se mide con scrollHeight en lugar de contar saltos de línea: así las líneas
    // largas que envuelven también cuentan y dejan de quedar cortadas.
    const resizeTextarea = () => {
        const textarea = ref.current;
        if (!textarea) return;
        // Colapsar el alto para medir mueve el scroll, así que se guarda y se
        // restaura: si no, al abrir una pestaña larga aparecía por el final.
        const { scrollTop } = textarea;
        textarea.style.height = 'auto';
        const needed = textarea.scrollHeight;
        textarea.style.height = `${Math.min(needed, maxHeight)}px`;
        textarea.style.overflowY = needed > maxHeight ? 'scroll' : 'hidden';
        textarea.scrollTop = scrollTop;
    }

    useEffect(() => {
        resizeTextarea()
    }, [indexTab.value])

    useEffect(() => {
        resizeTextarea()
        ref?.current?.focus();
    }, [])

    return <div class="flex justify-center px-4 pt-4 pb-2 sm:px-10 sm:pt-10 sm:pb-8">
        <textarea
            ref={ref}
            class="block p-2.5 w-full max-w-lg text-base sm:text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-[#242424] dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="Texto a convertir"
            value={tabs.value[indexTab.value]?.input ?? ''}
            onInput={(e) => {
                const tab = tabs.value[indexTab.value];
                if (!tab) return;
                const value = (e.target as HTMLTextAreaElement).value;
                tab.input = value;
                tab.values = splitValues(value, typeSplitSignal.value);
                tabs.value = [...tabs.value];
                resizeTextarea();
            }}
        />
    </div>
}


const QRCode = ({ value, size }: { value: string, size: number }) => {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const el = canvas.current;
        if (!el) return;
        setError(false);
        // qrcode dibuja de forma síncrona y sólo rechaza la promesa. Sin este
        // catch el canvas conservaba el QR anterior debajo de la etiqueta nueva:
        // un código que no corresponde al texto, sin ningún aviso.
        const drawing = QR.toCanvas(el, value, { width: size });

        // `width` deja el tamaño en el atributo del canvas -su resolución- y
        // además en style.width/height. Ese style en línea le gana a la clase, y
        // el QR se plantaba en sus `size` px en vez de ocupar la celda de la
        // grilla: en un teléfono se salía de la pantalla. Al borrarlo queda la
        // resolución alta del atributo y el tamaño lo decide el CSS.
        // Se limpia acá y no en un .then: toCanvas ya dibujó -es síncrono- y
        // esperar a la promesa dejaba un fotograma con el canvas a tamaño
        // completo, visible como un salto de la grilla al tipear.
        el.style.width = '';
        el.style.height = '';

        drawing.catch((e: unknown) => {
            el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
            console.error('No se pudo generar el QR de:', value, e);
            setError(true);
        });
    }, [value, size]);

    // El canvas se mantiene montado siempre (si se desmontara, `canvas.current`
    // quedaría en null y el componente no podría recuperarse del error).
    return <div class="relative w-full">
        <canvas class="w-full h-auto rounded-2xl sm:rounded-3xl" width={size} height={size} ref={canvas} />
        {error ? <div
            class="absolute inset-0 flex items-center justify-center p-4 text-sm font-medium text-center text-red-600 bg-white border-2 border-red-500 border-dashed rounded-2xl sm:rounded-3xl dark:bg-[#242424] dark:text-red-400"
            role="alert">
            No se pudo generar el QR
        </div> : null}
    </div>
}

const TabContent = () => {
    // Generar QRs with values
    let classQr = 'flex flex-col items-center gap-2 w-full max-w-[200px] mx-auto min-w-0'
    if (enableHoverSignal.value) {
        // Sólo de `sm` para arriba: en una pantalla táctil no hay puntero que
        // señale, y el group-hover dejaba toda la grilla atenuada al tocar un código.
        classQr += ' sm:transition-opacity sm:transform sm:duration-300 sm:hover:border-gray-900/10 sm:hover:bg-gray-900/10 sm:hover:!opacity-100 sm:group-hover:opacity-5 sm:hover:scale-110'
    }

    const tab = tabs.value[indexTab.value];
    const selected = selectedOf(selections.value, tab);
    const selectedAlter = selectedOf(selectionsAlter.value, tab);

    const selectQr = (v: string) => {
        if (!tab) return;

        if (enableDualCheckSignal.value) {
            if (!selected.has(v) && !selectedAlter.has(v)) {
                selected.add(v);
            } else if (selected.has(v)) {
                selected.delete(v);
                selectedAlter.add(v);
            } else if (selectedAlter.has(v)) {
                selectedAlter.delete(v);
            }
        } else {
            if (selected.has(v)) {
                selected.delete(v);
            } else {
                selected.add(v);
                selectedAlter.delete(v);
            }
        }

        writeSelections(cacheSelectedKey, selections, tab, selected);
        writeSelections(cacheSelectedKeyAlter, selectionsAlter, tab, selectedAlter);
    }

    return <div class="flex-1 flex flex-col dark:bg-[#242424]">
        <div class="flex-1 relative">
            <div class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] justify-items-center gap-x-4 gap-y-6 sm:gap-x-10 sm:gap-y-12 px-3 sm:px-6 pt-2 pb-28 sm:pb-24 group">
                {
                    tabs.value[indexTab.value]?.values.map((v, i) =>
                        <div key={i} class={classQr}>
                            <div
                                onClick={() => selectQr(v)}
                                class="relative flex items-center justify-center w-full transition-all duration-300 cursor-pointer active:scale-95 sm:hover:scale-105">
                                <QRCode value={v} size={256} />
                                {/* banner */}
                                {
                                    selected.has(v) ?
                                        <div class="absolute flex justify-center items-center bg-orange-600 bg-opacity-50 w-full h-full top-0 left-0 rounded-2xl sm:rounded-[24px] transition-all duration-300" >
                                            <div class="absolute flex justify-center items-center w-full h-full hover:opacity-0">
                                                <div class="absolute w-[72%] h-[7%] rounded-full -rotate-45 bg-orange-600 hover:hidden"></div>
                                                <div class="absolute w-[72%] h-[7%] rounded-full rotate-45 bg-orange-600 hover:hidden"></div>
                                            </div>
                                        </div>
                                        : null
                                }
                                {
                                    enableDualCheckSignal.value && selectedAlter.has(v) ?

                                        <div class="absolute flex justify-center items-center bg-blue-600 bg-opacity-50 w-full h-full top-0 left-0 rounded-2xl sm:rounded-[24px] transition-all duration-300" >
                                            <div class="absolute flex justify-center items-center w-full h-full hover:opacity-0">
                                                <div class="absolute w-[72%] h-[7%] rounded-full -rotate-45 bg-blue-600"></div>
                                                <div class="absolute w-[72%] h-[7%] rounded-full rotate-45 bg-blue-600" ></div>
                                            </div>
                                        </div>

                                        : null
                                }
                            </div>
                            <span class="w-full text-xs text-center break-all sm:text-base dark:text-white">{v}</span>
                        </div>
                    )
                }
            </div>
        </div>
    </div>
}

const YapeButton = () => {

    const [show, setShow] = useState(false);
    const ref = useRef<any>(null);

    const logoYape = useMemo(() => {
        return Math.random() > 0.5 ? true : false;
    }, [])

    useEffect(() => {
        if (show) {
            const listener = (e: any) => {
                if (!ref.current?.contains(e.target)) {
                    setShow(false);
                }
            }
            document.addEventListener('click', listener);
            return () => document.removeEventListener('click', listener);
        }
    }, [show])

    return (
        <>
            <div onClick={() => setShow(!show)} class="cursor-pointer">
                {logoYape ?
                    <img src={`${import.meta.env.BASE_URL}yape.png`} class="h-5" /> :
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M14.781,14.347h1.738c0.24,0,0.436-0.194,0.436-0.435v-1.739c0-0.239-0.195-0.435-0.436-0.435h-1.738c-0.239,0-0.435,0.195-0.435,0.435v1.739C14.347,14.152,14.542,14.347,14.781,14.347 M18.693,3.045H1.307c-0.48,0-0.869,0.39-0.869,0.869v12.17c0,0.479,0.389,0.869,0.869,0.869h17.387c0.479,0,0.869-0.39,0.869-0.869V3.915C19.562,3.435,19.173,3.045,18.693,3.045 M18.693,16.085H1.307V9.13h17.387V16.085z M18.693,5.653H1.307V3.915h17.387V5.653zM3.48,12.608h7.824c0.24,0,0.435-0.195,0.435-0.436c0-0.239-0.194-0.435-0.435-0.435H3.48c-0.24,0-0.435,0.195-0.435,0.435C3.045,12.413,3.24,12.608,3.48,12.608 M3.48,14.347h6.085c0.24,0,0.435-0.194,0.435-0.435s-0.195-0.435-0.435-0.435H3.48c-0.24,0-0.435,0.194-0.435,0.435S3.24,14.347,3.48,14.347"></path>
                    </svg>}
            </div>
            {show ? <div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                <img ref={ref} src={`${import.meta.env.BASE_URL}yape-cristian.webp`} class="max-h-[70%] border-collapse rounded-md" />
            </div> : null
            }
        </>
    )
}

const FloatSocialNetwork = () => {

    return <div class="flex items-center gap-3 text-sm dark:text-white">
        {/* <!-- Instagram --> */}
        <a href='https://www.instagram.com/_cventurac/' target='_blank' rel='noreferrer'>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path
                    d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
        </a>

        {/* <!-- Linkedin --> */}
        <a href='https://www.linkedin.com/in/vecacriju/' target='_blank' rel='noreferrer'>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path
                    d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
            </svg>
        </a>

        {/* <!-- Github --> */}
        <a href="https://github.com/maxterjunior" target='_blank' rel='noreferrer'>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
        </a>

        <YapeButton />

        <p class="whitespace-nowrap">❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>

    </div>
}

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
        img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
});

const ButtonsAccion = ({ compact, onOpenSettings }: { compact?: boolean, onOpenSettings?: () => void }) => {

    const print = async () => {

        const data = tabs.value[indexTab.value]?.values ?? [];
        if (!data.length) return alert('No hay QRs para imprimir');

        const imgs = await Promise.all(data.map(e => QR.toDataURL(e, { width: 200 })))

        const html = `
            <html>
                <head>
                    <title>Impresión de Qrs</title>
                    <meta charset="utf-8">
                        <style>
                            .qr {
                                display: inline-block;
                            margin: 10px;
                            text-align: center;
              }
                            .qr img {
                                width: 200px;
                            height: 200px;
              }
                            .qr p {
                                margin: 0;
                            font-size: 24px;
                            font-family: sans-serif;
                            font-weight: bold;
                            white-space: nowrap;
              }
                        </style>

                </head>
                <body onload="window.print();">
                    ${imgs.map((v, i) => `<div class="qr"><img src="${v}" ></img><p>${escapeHtml(data[i])}</p></div>`).join(" ")}
                </body>
                </html>
                `
        // ${data.map((v) => `<div class="qr"><img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${v}&choe=UTF-8" ></img><p>${v}</p></div>`).join(" ")}

        const win = window.open("", "print", "width=1000,height=600");
        // window.open devuelve null cuando el navegador bloquea el popup.
        if (!win) return alert('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio.');
        win.document.write(html);
        win.document.close();
    }

    // Alterna entre seleccionar todo y no seleccionar nada en la pestaña actual.
    // Antes limpiaba un set y el otro sólo a veces, dejándolos inconsistentes.
    const toggleSelectAll = () => {
        const tab = tabs.value[indexTab.value];
        if (!tab) return;

        const hasAny = selectedOf(selections.value, tab).size || selectedOf(selectionsAlter.value, tab).size;
        writeSelections(cacheSelectedKey, selections, tab, hasAny ? new Set() : new Set(tab.values));
        writeSelections(cacheSelectedKeyAlter, selectionsAlter, tab, new Set());
    }

    const readQr = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        // El handler se registra antes del click: al revés dependía de que el
        // diálogo del navegador tardara en abrir.
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const img = await loadImage(file);
                const code = await QrScanner.scanImage(img);
                if (!code) return alert('No se encontró ningún código QR en la imagen');

                const tab = tabs.value[indexTab.value];
                if (!tab) return;
                tab.input = tab.input ? tab.input + '\n' + code : code;
                tab.values = splitValues(tab.input, typeSplitSignal.value);
                tabs.value = [...tabs.value];
            } catch (error) {
                // Antes esto era un console.log: el usuario elegía una imagen y
                // no pasaba absolutamente nada.
                console.error(error);
                alert('No se pudo leer el código QR de esa imagen');
            }
        }
        input.click();
    }

    const printZebra = async () => {
        const qrs = tabs.value[indexTab.value]?.values ?? [];
        if (!qrs.length) return alert('No hay QRs para imprimir');

        const arraySplit = (arr: string[], size: number) => arr.reduce((acc, e, i) => (i % size ? acc[acc.length - 1].push(e) : acc.push([e]), acc), [] as string[][]);
        const trimText = (length: number, text: string) => text.length > length ? text.substring(0, length) : text;


        // Define printer
        const config = {
            yAlign: 3.6,
            xAlignBase: 1,
            xAlignFactor: 26.1,
            fontSize: '0,2',
            qrSize: 0.9
        }

        let commands = '';

        const filas = arraySplit(qrs, 4);


        for (const [rowIndex, fila] of filas.entries()) {

            commands += `^XA
  ^MUM
  ^${rowIndex === filas.length - 1 ? 'MMC' : 'MMT'}
  ^PW1000
  ^LL1218
  ^LS0 
  `;

            for (const [col, qr] of fila.entries()) {

                commands += `^FT${1.2 + config.xAlignBase + col * config.xAlignFactor},${config.yAlign + 21.7}
              ^BQN,2,${config.qrSize}${zplSpecial.test(qr) ? '\n              ^FH\\' : ''}
              ^FDLA,${zplSpecial.test(qr) ? escapeZpl(qr) : qr}
              ^FS
              
              ^FT${config.xAlignBase + col * config.xAlignFactor},${config.yAlign + 21.8}
              ^A0N,${config.fontSize}
              ^FH\
              ^FD${escapeZpl(trimText(23, qr))}
              ^FS 
  `;

            }

            commands += `^PQ1,0,1,Y^XZ`;

        }

        console.log(commands);

        const browserPrint = new ZebraBrowserPrintWrapper();

        // List printers
        const printers = await browserPrint.getAvailablePrinters();

        // Validar que printers no sea un Error
        if (printers instanceof Error) return alert(printers.message);

        // Select default printer 
        if (printers.length === 0) return alert('Could not find any printer');

        const defaultPrinter = printers[0];

        // Set the printer
        browserPrint.setPrinter(defaultPrinter);

        // Check printer status
        const printerStatus = await browserPrint.checkPrinterStatus();

        // Check if the printer is ready
        if (printerStatus.isReadyToPrint) {
            const zpl = commands;
            browserPrint.print(zpl);
        } else {
            console.error("Error/s", printerStatus.errors);
            alert('Print:' + printerStatus.errors);
        }

    }


    // En un teléfono los siete controles no entran en una fila: la barra táctil
    // se queda con las cuatro acciones y los interruptores pasan a Ajustes.
    if (compact) return <div class="grid grid-cols-5">
        <TouchAction label="Leer" onClick={readQr}><QrIcon /></TouchAction>
        <TouchAction label="Marcar" onClick={toggleSelectAll}><CheckAllIcon /></TouchAction>
        <TouchAction label="Imprimir" onClick={print}><PrintIcon /></TouchAction>
        <TouchAction label="Zebra" onClick={printZebra}><LabelIcon /></TouchAction>
        <TouchAction label="Ajustes" onClick={() => onOpenSettings?.()}><GearIcon /></TouchAction>
    </div>

    return <div class="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">

        {/* Dual Check */}
        <div class="inline-flex items-center gap-2">
            <label class="font-bold text-orange-500">Check</label>
            <label class="font-bold text-blue-500">Dual</label>
            <Switch label="Marcar en dos colores" checked={enableDualCheckSignal.value} onChange={() => setFlag(enableDualCheckSignal, enableDualCheckKey, !enableDualCheckSignal.value)} />
        </div>

        {/* Button read qr */}
        <button onClick={readQr} class="inline-flex items-center justify-center gap-2 p-2 text-gray-400 bg-white rounded-md dark:bg-transparent dark:hover:bg-white/10 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
            <span>Read</span>
            <QrIcon />
        </button>

        {/* Button clear */}
        <button onClick={toggleSelectAll} class="inline-flex items-center justify-center gap-2 p-2 text-gray-400 bg-white rounded-md dark:bg-transparent dark:hover:bg-white/10 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
            <span>Selected</span>
            <CheckAllIcon />
        </button>

        <div class="inline-flex items-center gap-2">
            <label class="font-bold text-blue-500">Hover</label>
            <Switch label="Resaltar el código señalado" checked={enableHoverSignal.value} onChange={() => setFlag(enableHoverSignal, enableHoverKey, !enableHoverSignal.value)} />
        </div>

        <div class="inline-flex items-center gap-2">
            <label class="font-bold text-red-500">/\s/</label>
            <Switch label="Separar por saltos de línea" checked={typeSplitSignal.value} onChange={() => setTypeSplit(!typeSplitSignal.value)} />
            <label class="font-bold text-orange-500">\n</label>
        </div>

        <button onClick={printZebra} class="inline-flex items-center justify-center p-2 text-gray-400 bg-white rounded-md dark:bg-transparent dark:hover:bg-white/10 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
            Print Zebras
        </button>

        <button onClick={print} class="inline-flex items-center justify-center p-2 text-gray-400 bg-white rounded-md dark:bg-transparent dark:hover:bg-white/10 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
            <span class="sr-only">Imprimir</span>
            <PrintIcon />
        </button>
    </div>
}

// --- Piezas compartidas por la fila de escritorio y la barra táctil -----------

const PrintIcon = () => (
    <svg class="w-6 h-6" fill="currentColor" stroke="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M57.7881012,14.03125H52.5v-8.0625c0-2.2091999-1.7909012-4-4-4h-33c-2.2091999,0-4,1.7908001-4,4v8.0625H6.2119002 C2.7871001,14.03125,0,16.8183498,0,20.2431507V46.513649c0,3.4248009,2.7871001,6.2119026,6.2119002,6.2119026h2.3798995 c0.5527,0,1-0.4472008,1-1c0-0.5527-0.4473-1-1-1H6.2119002C3.8896,50.7255516,2,48.8359489,2,46.513649V20.2431507 c0-2.3223,1.8896-4.2119007,4.2119002-4.2119007h51.5762024C60.1102982,16.03125,62,17.9208508,62,20.2431507V46.513649 c0,2.3223-1.8897018,4.2119026-4.2118988,4.2119026H56c-0.5527992,0-1,0.4473-1,1c0,0.5527992,0.4472008,1,1,1h1.7881012 C61.2128983,52.7255516,64,49.9384499,64,46.513649V20.2431507C64,16.8183498,61.2128983,14.03125,57.7881012,14.03125z M13.5,5.96875c0-1.1027999,0.8971996-2,2-2h33c1.1027985,0,2,0.8972001,2,2v8h-37V5.96875z"></path>
        <path d="M44,45.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,47.0302505,20,47.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,45.0322495,44,45.0322495z"></path>
        <path d="M44,52.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,54.0302505,20,54.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,52.0322495,44,52.0322495z"></path>
        <circle cx="7.9590998" cy="21.8405495" r="2"></circle>
        <circle cx="14.2856998" cy="21.8405495" r="2"></circle>
        <circle cx="20.6121998" cy="21.8405495" r="2"></circle>
        <path d="M11,62.03125h42v-26H11V62.03125z M13.4036999,38.4349518h37.1925964v21.1925964H13.4036999V38.4349518z"></path>
    </svg>
)

const CheckAllIcon = () => (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 11.5l3 3L21.5 5" />
        <path d="M20 12.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h11" />
    </svg>
)

const LabelIcon = () => (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z" />
        <path d="M7 7h.01" />
    </svg>
)

const GearIcon = () => (
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.2.5.68.85 1.22.91H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
)

// El pomo se posiciona con `after:` contra este label, así que el label envuelve
// sólo al interruptor: si abarcara también los textos, el pomo saldría corrido.
const Switch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: string }) => (
    <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} class="sr-only peer" aria-label={label} onChange={onChange} />
        <div class="flex-shrink-0 w-11 h-6 sm:w-9 sm:h-5 bg-gray-200 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-300 dark:peer-focus-visible:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 sm:after:h-4 sm:after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
)

const TouchAction = ({ label, onClick, children }: { label: string, onClick: () => void, children: any }) => (
    <button type="button" onClick={onClick}
        class="flex flex-col items-center justify-center gap-1 px-1 py-2 min-h-[3.5rem] text-[11px] font-medium text-gray-500 active:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-gray-300 dark:active:bg-white/10">
        <span class="flex items-center justify-center w-6 h-6" aria-hidden="true">{children}</span>
        {label}
    </button>
)

/**
 * Ajustes del teléfono. Son los mismos tres interruptores de la barra de
 * escritorio, pero con el nombre escrito entero: en la barra alcanza con la
 * abreviatura porque está al lado de los códigos, acá no hay ese contexto.
 */
const SettingsSheet = ({ onClose }: { onClose: () => void }) => {

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const row = "flex items-center justify-between gap-4 py-3 border-b border-black/5 last:border-0 dark:border-white/10";

    return <div
        class="fixed inset-0 z-40 flex items-end bg-zinc-900/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none dark:bg-black/70 lg:hidden"
        onClick={onClose}>
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Ajustes"
            onClick={(e) => e.stopPropagation()}
            class="w-full bg-white rounded-t-2xl animate-dialog-in motion-reduce:animate-none dark:bg-[#1f1f1f] px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">

            <div class="w-10 h-1 mx-auto mb-3 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true"></div>

            <div class="text-sm text-zinc-800 dark:text-zinc-200">
                <div class={row}>
                    <span>Marcar en dos colores</span>
                    <Switch label="Marcar en dos colores" checked={enableDualCheckSignal.value} onChange={() => setFlag(enableDualCheckSignal, enableDualCheckKey, !enableDualCheckSignal.value)} />
                </div>
                <div class={row}>
                    <span>Resaltar el código señalado</span>
                    <Switch label="Resaltar el código señalado" checked={enableHoverSignal.value} onChange={() => setFlag(enableHoverSignal, enableHoverKey, !enableHoverSignal.value)} />
                </div>
                <div class={row}>
                    <span>
                        Separar por saltos de línea
                        <span class="block text-xs text-zinc-500 dark:text-zinc-400">
                            {typeSplitSignal.value ? 'Un código por línea' : 'Un código por cada espacio o salto'}
                        </span>
                    </span>
                    <Switch label="Separar por saltos de línea" checked={typeSplitSignal.value} onChange={() => setTypeSplit(!typeSplitSignal.value)} />
                </div>
            </div>

            <div class="flex items-center justify-between gap-4 pt-4">
                <FloatSocialNetwork />
                <button type="button" onClick={onClose}
                    class="px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-white/10">
                    Cerrar
                </button>
            </div>
        </div>
    </div>
}

const Footer = () => {

    const [settings, setSettings] = useState(false);

    return <>
        {settings ? <SettingsSheet onClose={() => setSettings(false)} /> : null}
        <footer class="fixed bottom-0 z-10 w-full border-t bg-white/95 backdrop-blur border-black/5 dark:bg-[#242424]/95 dark:border-white/10 pb-[env(safe-area-inset-bottom)]">
            {/* Escritorio: enlaces de un lado, controles del otro. */}
            <div class="items-center justify-between hidden gap-4 px-3 py-1 lg:flex">
                <FloatSocialNetwork />
                <ButtonsAccion />
            </div>
            {/* Teléfono: barra de acciones con blancos del tamaño de un dedo. */}
            <div class="lg:hidden">
                <ButtonsAccion compact onOpenSettings={() => setSettings(true)} />
            </div>
        </footer>
    </>
}

const App = () => {
    return <div class="flex flex-col app-shell dark:bg-[#242424]">
        <h1 class="sr-only">Generador de códigos QR masivo</h1>
        <HeaderTab />
        <TextArea />
        <TabContent />
        <Footer />
    </div>
}


restoreTabs();

// Subscribe to tabs changes
// Persiste siempre, incluido el array vacío: con el guard `if (tabs.length)`,
// borrar la última pestaña dejaba el cache viejo y las pestañas reaparecían.
tabs.subscribe((tabs) => {
    localStorage.setItem(cacheTabsKey, JSON.stringify(tabs))
});

// Preact no borra los hijos preexistentes del contenedor raíz: sólo limpia los
// sobrantes de un elemento que esté representado por un vnode (diffElementNodes),
// y #app no lo está —se pasa como parentDom y se le diffea un Fragment—. Por eso
// el bloque estático se saca explícitamente en vez de confiar en el framework.
document.getElementById('pre-render')?.remove();

render(<App />, document.getElementById('app') as HTMLElement);