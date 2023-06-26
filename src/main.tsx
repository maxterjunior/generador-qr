import { render } from "preact";
import { signal } from "@preact/signals";
import "./index.css";
import Editable from "./components/editable";
import { useEffect, useRef } from "preact/hooks";
import QR from "qrcode";

// import "./style.css";


// const $ = (selector: string) => document.getElementById(selector);

// const max = 400;
// const min = 50;

// let size = 200;
// let values = "";
// let data: any[] = [];

// document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
//   <div>
//     <div class="header-container">
//       <div class="header">
//         <h1>Generador de QRs</h1>
//       </div>

//       <textarea class="input" id="input" placeholder="Escribe algo"></textarea>
//     </div>
//     <div class="card" id="output" >
//     </div>

//     <div class="footer">
//     <button id="print" style="margin-right:10px"> imprimir </button> 
//     <input id="size" value="${size}" placeholder="Tamaño" type="number" max="${max}" min="${min}"> <p>❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>
//     </div>

//   </div>
// `;

// const renderQrs = () => {
//   // regular expression for spaces and line breaks
//   const v = values.split(/\s/g).filter((v: string) => v);
//   data = v;
//   $("output")!.innerHTML = "";
//   v.forEach((value: string) => {
//     const canvas = document.createElement("canvas");
//     QR.toCanvas(canvas, value, { width: size });
//     $("output")!.appendChild(canvas);
//   });
// };

// const reziseTextarea = () => {
//   const textarea = $("input") as HTMLTextAreaElement;
//   if (!textarea) return;
//   textarea.style.height = "auto";
//   textarea.style.height = (textarea.scrollHeight) + "px";
//   if (textarea.scrollHeight >= 200) {
//     textarea.style.overflowY = "scroll";
//     textarea.style.height = "200px";
//   } else if (textarea.value.length <= 1) {
//     textarea.style.overflowY = "hidden";
//     textarea.style.height = "15px";
//   }
// }

// $("size")!.addEventListener("input", (e) => {
//   const v = parseInt((e.target as HTMLInputElement).value);
//   if (v > max) {
//     size = max;
//     ($("size") as HTMLInputElement)!.value = size.toString();
//   } else if (v < min) size = min;
//   else size = v;

//   renderQrs();
// });

// $("input")!.addEventListener("input", (e: any) => {

//   reziseTextarea()

//   if (e.target && e.target.value) {
//     values = e.target.value;
//     try {
//       localStorage.setItem("values", values || '');
//     } catch (error) {
//       console.error("Error al guardar valores", error);
//     }
//     renderQrs();
//   } else {
//     $("output")!.innerHTML = "";
//     localStorage.removeItem("values");
//   }
// });

// $("print")!.addEventListener("click", () => {
//   const html = `
//   <html>
//   <head>
//     <title>Impresión de Qrs</title>
//     <meta charset="utf-8">
//     <style>
//       .qr {
//         display: inline-block;
//         margin: 10px;
//         text-align: center;
//       }
//       .qr img {
//         width: 200px;
//         height: 200px;
//       }
//       .qr p {
//         margin: 0;
//         font-size: 24px;
//         font-family: sans-serif;
//         font-weight: bold;
//         white-space: nowrap;
//       }
//     </style>

//   </head>
//     <body onload="window.print();">
//     ${data.map((v) => `<div class="qr"><img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${v}&choe=UTF-8" ></img><p>${v}</p></div>`).join(" ")}
//     </body>
//   </html>
//   `
//   // const popupWin = window.open("", "", "top=0,left=0,height=100%,width=auto");
//   // popupWin?.document.open();
//   // popupWin?.document.write(`
//   //   <html>
//   //   <head>
//   //     <title>Impresión de Qrs</title>
//   //     <meta charset="utf-8">
//   //     <style></style>
//   //   </head>
//   //    <body onload="window.print();window.close()">
//   //    ${html}
//   //    </body>
//   //   </html>
//   // `);

//   // Abre un nuevo tab con el contenido e imprime luego de cargar las imagenes
//   const win = window.open();
//   win?.document.write(html);
//   // win?.document.onload = () => win?.print();
//   // win?.print();
// });

// try {
//   const cache = localStorage.getItem("values");
//   if (cache) {
//     values = cache;
//     ($("input") as HTMLInputElement).value = values;
//     reziseTextarea()
//     renderQrs();
//   }
// } catch (error) {
//   console.error("Error al obtener valores anteriores", error);
// }

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
    </div>
}


// Subscribe to tabs changes

tabs.subscribe((tabs) => {
    if (tabs.length) {
        localStorage.setItem(cacheTabsKey, JSON.stringify(tabs))
    }
});

render(<App />, document.getElementById('app') as HTMLElement);