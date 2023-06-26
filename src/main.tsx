import { render } from "preact";
import { signal } from "@preact/signals";
import "./index.css";
import Editable from "./components/editable";
import { useEffect, useRef } from "preact/hooks";
import QR from "qrcode";

// Migra a preact
interface Tab {
    name: string;
    input: string;
    values: string[];
}

const cacheIndexKey = 'index-tab';
const cacheTabsKey = 'tabs-qr';

const indexTab = signal(-1);

const tabs = signal<Tab[]>([]);

const addTab = () => {
    tabs.value = [...tabs.value, { name: `Tab ${tabs.value.length + 1}`, input: '', values: [] }];
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
    return <div class="header-container">
        <div class="space-y-5">
            <div class="border-b border-b-gray-200 overflow-y-hidden">
                <ul class="-mb-px flex items-center gap-4 text-sm font-medium overflow-x-auto">
                    {
                        tabs.value.map((_, i) =>
                            <li class="flex-1 max-w-xs min-w-[100px] ">
                                <span
                                    className={`cursor-pointer relative flex items-center justify-center gap-2 px-1 py-1 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-full ${indexTab.value === i ? 'text-blue-700 after:bg-blue-700 hover:text-blue-700' : 'hover:after:bg-blue-400'}`}
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

                                    <button onClick={() => deleteTab(i)} type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                                        <span class="sr-only">Close menu</span>
                                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            </li>
                        )
                    }
                    <button onClick={addTab} type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
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

    return <div class="flex justify-center my-10">
        <textarea
            ref={ref}
            class="block border-0 p-0 m-0 focus:ring-0 focus:border-transparent min-w-[50%] max-h-lg"
            // class="block border-0 p-0 m-0 focus:ring-0 focus:border-transparent min-w-[500px] max-h-lg"
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
    return <canvas ref={canvas} />
}

const TabContent = () => {
    // Generar QRs with values
    return <div class="flex-1 flex flex-col">
        <div class="flex-1 relative">
            <div class="flex flex-wrap gap-5 p-2 mb-10 justify-center">
                {
                    tabs.value[indexTab.value]?.values.map((v, i) =>
                        <div key={i} class="flex flex-col items-center gap-2">
                            <QRCode value={v} size={200} />
                            <span class="text-sm">{v}</span>
                        </div>
                    )
                }
            </div>
        </div>
    </div>
}

const Footer = () => {
    return <div class="fixed bottom-0 w-full p-2 text-center">
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

    return <div class="fixed bottom-0 right-0 p-2">
        <button onClick={print} class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
            <span class="sr-only">Print</span>
            <svg class="h-6 w-6" fill="currentColor" stroke="currentColor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64" >
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Printer"> <path d="M57.7881012,14.03125H52.5v-8.0625c0-2.2091999-1.7909012-4-4-4h-33c-2.2091999,0-4,1.7908001-4,4v8.0625H6.2119002 C2.7871001,14.03125,0,16.8183498,0,20.2431507V46.513649c0,3.4248009,2.7871001,6.2119026,6.2119002,6.2119026h2.3798995 c0.5527,0,1-0.4472008,1-1c0-0.5527-0.4473-1-1-1H6.2119002C3.8896,50.7255516,2,48.8359489,2,46.513649V20.2431507 c0-2.3223,1.8896-4.2119007,4.2119002-4.2119007h51.5762024C60.1102982,16.03125,62,17.9208508,62,20.2431507V46.513649 c0,2.3223-1.8897018,4.2119026-4.2118988,4.2119026H56c-0.5527992,0-1,0.4473-1,1c0,0.5527992,0.4472008,1,1,1h1.7881012 C61.2128983,52.7255516,64,49.9384499,64,46.513649V20.2431507C64,16.8183498,61.2128983,14.03125,57.7881012,14.03125z M13.5,5.96875c0-1.1027999,0.8971996-2,2-2h33c1.1027985,0,2,0.8972001,2,2v8h-37V5.96875z"></path> <path d="M44,45.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,47.0302505,20,47.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,45.0322495,44,45.0322495z"></path>
                    <path d="M44,52.0322495H20c-0.5517998,0-0.9990005,0.4472008-0.9990005,0.9990005S19.4482002,54.0302505,20,54.0302505h24 c0.5517006,0,0.9990005-0.4472008,0.9990005-0.9990005S44.5517006,52.0322495,44,52.0322495z"></path>
                    <circle cx="7.9590998" cy="21.8405495" r="2"></circle>
                    <circle cx="14.2856998" cy="21.8405495" r="2"></circle>
                    <circle cx="20.6121998" cy="21.8405495" r="2"></circle>
                    <path d="M11,62.03125h42v-26H11V62.03125z M13.4036999,38.4349518h37.1925964v21.1925964H13.4036999V38.4349518z"></path> </g> </g>
            </svg>
        </button>
    </div>
}

const App = () => {

    useEffect(() => {
        try {
            const cache = JSON.parse(localStorage.getItem(cacheTabsKey) || '[]');
            if (cache.length) {
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

    return <div class="flex flex-col h-screen">
        <HeaderTab />
        <TextArea />
        <TabContent />
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