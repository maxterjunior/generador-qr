import "./style.css";
import QR from "qrcode";

const $ = (selector: string) => document.getElementById(selector);

const max = 400;
const min = 50;

let size = 200;
let values = "";
let data: any[] = [];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <div class="header-container">
      <div class="header">
        <h1>Generador de QRs</h1>
      </div>

      <textarea class="input" id="input" placeholder="Escribe algo"></textarea>
    </div>
    <div class="card" id="output" >
    </div>

    <div class="footer">
    <button id="print" style="margin-right:10px"> imprimir </button> 
    <input id="size" value="${size}" placeholder="Tamaño" type="number" max="${max}" min="${min}"> <p>❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>
    </div>
      
  </div>
`;

const renderQrs = () => {
  // regular expression for spaces and line breaks
  const v = values.split(/\s/g).filter((v: string) => v);
  data = v;
  $("output")!.innerHTML = "";
  v.forEach((value: string) => {
    const canvas = document.createElement("canvas");
    QR.toCanvas(canvas, value, { width: size });
    $("output")!.appendChild(canvas);
  });
};

const reziseTextarea = () => {
  const textarea = $("input") as HTMLTextAreaElement;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = (textarea.scrollHeight) + "px";
  if (textarea.scrollHeight >= 200) {
    textarea.style.overflowY = "scroll";
    textarea.style.height = "200px";
  } else if (textarea.value.length <= 1) {
    textarea.style.overflowY = "hidden";
    textarea.style.height = "15px";
  }
}

$("size")!.addEventListener("input", (e) => {
  const v = parseInt((e.target as HTMLInputElement).value);
  if (v > max) {
    size = max;
    ($("size") as HTMLInputElement)!.value = size.toString();
  } else if (v < min) size = min;
  else size = v;

  renderQrs();
});

$("input")!.addEventListener("input", (e: any) => {
  
  reziseTextarea()

  if (e.target && e.target.value) {
    values = e.target.value;
    try {
      localStorage.setItem("values", values || '');
    } catch (error) {
      console.error("Error al guardar valores", error);
    }
    renderQrs();
  } else {
    $("output")!.innerHTML = "";
    localStorage.removeItem("values");
  }
});

$("print")!.addEventListener("click", () => {
  const html = data.map((v) => `<img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${v}&choe=UTF-8" ></img>`).join(" ");
  // const popupWin = window.open("", "", "top=0,left=0,height=100%,width=auto");
  // popupWin?.document.open();
  // popupWin?.document.write(`
  //   <html>
  //   <head>
  //     <title>Impresión de Qrs</title>
  //     <meta charset="utf-8">
  //     <style></style>
  //   </head>
  //    <body onload="window.print();window.close()">
  //    ${html}
  //    </body>
  //   </html>
  // `);

  // Abre un nuevo tab con el contenido e imprime luego de cargar las imagenes
  const win = window.open();
  win?.document.write(html);
  // win?.document.onload = () => win?.print();
  // win?.print();
});

try {
  const cache = localStorage.getItem("values");
  if (cache) {
    values = cache;
    ($("input") as HTMLInputElement).value = values;
    reziseTextarea()
    renderQrs();
  }
} catch (error) {
  console.error("Error al obtener valores anteriores", error);
}
