import { signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import QR from "qrcode";
import Editable from "./components/editable";
import "./index.css";

// Migra a preact
interface Tab {
    name: string;
    input: string;
    values: string[];
    show: boolean;
}

const cacheIndexKey = 'index-tab';
const cacheTabsKey = 'tabs-qr';

const indexTab = signal(-1);

const tabs = signal<Tab[]>([]);

const addTab = () => {
    const tab: Tab = { name: `Tab ${tabs.value.length + 1}`, input: '', values: [], show: true }
    tabs.value = [...tabs.value, tab];
    indexTab.value = tabs.value.length - 1;
}

const deleteTab = (index: number) => {
    if (index < 0 || index >= tabs.value.length) return;
    tabs.value.splice(index, 1);
    tabs.value = [...tabs.value];
    indexTab.value = tabs.value.length - 1;
}

const selectTab = (index: number) => {
    if (index < 0 || index >= tabs.value.length) return;
    indexTab.value = index;
    localStorage.setItem(cacheIndexKey, index.toString());
}


const HeaderTab = () => {
    return <div class="header-container dark:bg-[#242424]">
        <div class="space-y-5">
            <div class="border-b border-b-gray-200 overflow-y-hidden dark:border-[#242424]">
                <ul class="-mb-px flex items-center gap-4 text-sm font-medium overflow-x-auto">
                    {
                        tabs.value.map((_, i) =>
                            <li class="flex-1 min-w-[250px] w-full">
                                <span
                                    className={`cursor-pointer relative w-full text-center flex items-center justify-center gap-2 px-1 py-1 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-full ${indexTab.value === i ? 'text-blue-700 dark:text-blue-500 after:bg-blue-700 hover:text-blue-700 font-bold' : 'hover:after:bg-blue-400  dark:text-white'}`}
                                    onClick={() => selectTab(i)}
                                >
                                    <Editable
                                        text={tabs.value[i].name}
                                        placeholder="Nombre de la pestaña"
                                        type="input"
                                        onChange={(value) => {
                                            if (value) {
                                                tabs.value[i].name = value
                                                tabs.value = [...tabs.value]
                                            }
                                        }}
                                    />

                                    <button onClick={() => deleteTab(i)} type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:bg-[#242424]">
                                        <span class="sr-only">Close menu</span>
                                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            </li>
                        )
                    }
                    <button onClick={addTab} type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:bg-[#242424]">
                        <span class="sr-only">Add Tab</span>
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </ul>
            </div>
        </div>
    </div>
}

const TextArea = () => {

    const ref = useRef<HTMLTextAreaElement>(null);

    const resizeTextarea = () => {
        const textarea = ref?.current;
        if (textarea) {
            const lines = textarea.value.split(/\r*\n/).length;
            if (lines > 5) {
                textarea.style.overflowY = "scroll";
                textarea.style.height = "200px";
            } else {
                textarea.style.overflowY = "hidden";
                textarea.style.height = `${lines * 1.5}rem`;
            }
        }
    }

    useEffect(() => {
        resizeTextarea()
    }, [indexTab.value])

    useEffect(() => {
        resizeTextarea()
        ref?.current?.focus();
    }, [])

    return <div class="flex justify-center m-10">
        <textarea
            ref={ref}
            class="block p-2.5 w-full max-w-lg text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-[#242424] dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="Texto a convertir"
            value={tabs.value[indexTab.value]?.input}
            onInput={(e) => {
                tabs.value[indexTab.value]!.input = (e.target as HTMLTextAreaElement).value;
                tabs.value[indexTab.value]!.values = (e.target as HTMLTextAreaElement).value.split(/\s/g).filter((v: string) => v);
                tabs.value = [...tabs.value];
                resizeTextarea();
            }}
        />
    </div>
}


const QRCode = ({ value, size }: { value: string, size: number }) => {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!canvas.current) return;
        QR.toCanvas(canvas.current, value, { width: size });
    }, [value, size]);
    return <canvas class='rounded-3xl' ref={canvas} />
}

const TabContent = () => {
    // Generar QRs with values
    return <div class="flex-1 flex flex-col dark:bg-[#242424]">
        <div class="flex-1 relative">
            <div class="flex flex-wrap gap-20 p-2 mb-10 justify-center">
                {
                    tabs.value[indexTab.value]?.values.map((v, i) =>
                        <div key={i} class="flex flex-col items-center gap-2">
                            <QRCode value={v} size={200} />
                            <span class="text-base dark:text-white">{v}</span>
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
            <div onClick={() => setShow(!show)} >
                {logoYape ?
                    <img src='/generador-qr/yape.png' class="h-5" /> :
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M14.781,14.347h1.738c0.24,0,0.436-0.194,0.436-0.435v-1.739c0-0.239-0.195-0.435-0.436-0.435h-1.738c-0.239,0-0.435,0.195-0.435,0.435v1.739C14.347,14.152,14.542,14.347,14.781,14.347 M18.693,3.045H1.307c-0.48,0-0.869,0.39-0.869,0.869v12.17c0,0.479,0.389,0.869,0.869,0.869h17.387c0.479,0,0.869-0.39,0.869-0.869V3.915C19.562,3.435,19.173,3.045,18.693,3.045 M18.693,16.085H1.307V9.13h17.387V16.085z M18.693,5.653H1.307V3.915h17.387V5.653zM3.48,12.608h7.824c0.24,0,0.435-0.195,0.435-0.436c0-0.239-0.194-0.435-0.435-0.435H3.48c-0.24,0-0.435,0.195-0.435,0.435C3.045,12.413,3.24,12.608,3.48,12.608 M3.48,14.347h6.085c0.24,0,0.435-0.194,0.435-0.435s-0.195-0.435-0.435-0.435H3.48c-0.24,0-0.435,0.194-0.435,0.435S3.24,14.347,3.48,14.347"></path>
                    </svg>}
            </div>
            {show ? <div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                <img ref={ref} src='/generador-qr/yape-cristian.webp' class="max-h-[70%] border-collapse rounded-md" />
            </div> : null
            }
        </>
    )
}

const FloatSocialNetwork = () => {

    return <div class="fixed bottom-0 left-0 p-2 z-10 dark:text-white gap-3 flex">
        {/* <!-- Instagram --> */}
        <a href='https://instagram.com/caballero_cristian_abcs?utm_source=qr&igshid=NGExMmI2YTkyZg%3D%3D' target='_blank' rel='noreferrer'>
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
    </div>
}

const Footer = () => {
    return <div class="fixed bottom-0 w-full p-2 text-center z-0 dark:text-white">
        <p>❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>
    </div>
}

const ButtonPrint = () => {

    const print = () => {

        const data = tabs.value[indexTab.value]?.values;

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
                    ${data.map((v) => `<div class="qr"><img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${v}&choe=UTF-8" ></img><p>${v}</p></div>`).join(" ")}
                </body>
            </html>
            `

        const win = window.open("", "print", "width=1000,height=600");
        win!.document.write(html);
        win!.document.close();
    }

    return <div class="fixed bottom-0 right-0 p-2 z-10">
        <button onClick={print} class="bg-white dark:bg-[#242424] dark:hover:bg-[#3a3a3a] rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
            <span class="sr-only">Print</span>
            <svg class="h-6 w-6" fill="currentColor" stroke="currentColor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64" >
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                    <g id="Printer"> <path d="M57.7881012,14.03125H52.5v-8.0625c0-2.2091999-1.7909012-4-4-4h-33c-2.2091999,0-4,1.7908001-4,4v8.0625H6.2119002 C2.7871001,14.03125,0,16.8183498,0,20.2431507V46.513649c0,3.4248009,2.7871001,6.2119026,6.2119002,6.2119026h2.3798995 c0.5527,0,1-0.4472008,1-1c0-0.5527-0.4473-1-1-1H6.2119002C3.8896,50.7255516,2,48.8359489,2,46.513649V20.2431507 c0-2.3223,1.8896-4.2119007,4.2119002-4.2119007h51.5762024C60.1102982,16.03125,62,17.9208508,62,20.2431507V46.513649 c0,2.3223-1.8897018,4.2119026-4.2118988,4.2119026H56c-0.5527992,0-1,0.4473-1,1c0,0.5527992,0.4472008,1,1,1h1.7881012 C61.2128983,52.7255516,64,49.9384499,64,46.513649V20.2431507C64,16.8183498,61.2128983,14.03125,57.7881012,14.03125z M13.5,5.96875c0-1.1027999,0.8971996-2,2-2h33c1.1027985,0,2,0.8972001,2,2v8h-37V5.96875z"></path>
                        <path d="M44,45.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,47.0302505,20,47.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,45.0322495,44,45.0322495z"></path>
                        <path d="M44,52.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,54.0302505,20,54.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,52.0322495,44,52.0322495z"></path>
                        <circle cx="7.9590998" cy="21.8405495" r="2"></circle>
                        <circle cx="14.2856998" cy="21.8405495" r="2"></circle>
                        <circle cx="20.6121998" cy="21.8405495" r="2"></circle>
                        <path d="M11,62.03125h42v-26H11V62.03125z M13.4036999,38.4349518h37.1925964v21.1925964H13.4036999V38.4349518z"></path>
                    </g>
                </g>
            </svg>
        </button>
    </div>
}

const App = () => {

    useEffect(() => {
        try {
            const cache = JSON.parse(localStorage.getItem(cacheTabsKey) || '[]');
            if (cache.length) {
                for (const tab of cache) tab.show ??= true;
                tabs.value = cache;
            } else {
                addTab();
            }

            const index = parseInt(localStorage.getItem(cacheIndexKey) || '0');
            if (index >= 0 && index < tabs.value.length) {
                indexTab.value = index;
            }

        } catch (error) {
            console.error("Error al obtener valores anteriores", error);
            addTab();
        }
    }, []);

    return <div class="flex flex-col h-screen dark:bg-[#242424]">
        <HeaderTab />
        <TextArea />
        <TabContent />
        <FloatSocialNetwork />
        <Footer />
        <ButtonPrint />
    </div>
}


// Subscribe to tabs changes

tabs.subscribe((tabs) => {
    if (tabs.length) {
        localStorage.setItem(cacheTabsKey, JSON.stringify(tabs))
    }
});

render(<App />, document.getElementById('app') as HTMLElement);