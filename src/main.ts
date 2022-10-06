import './style.css'
import QR from 'qrcode'

const $ = (selector: string) => document.getElementById(selector)

const max = 400
const min = 50

let size = 200
let values = ''

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>

    

    <div class="header">
      <h1>Generador de QRs</h1>
    </div>

    <textarea class="input" id="input" placeholder="Escribe algo"></textarea>

    <div class="card" id="output" >
    </div>

    <div class="footer">
    <input id="size" value="${size}" placeholder="Tamaño" type="number" max="${max}" min="${min}"> <p>❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>
    </div>
      
  </div>
`

const renderQrs = () => {
  // regular expression for spaces and line breaks
  const v = values.split(/\s/g).filter((v: string) => v)
  $('output')!.innerHTML = ''
  v.forEach((value: string) => {
    const canvas = document.createElement('canvas')
    QR.toCanvas(canvas, value, { width: size })
    $('output')!.appendChild(canvas)
  })
}

$('size')!.addEventListener('input', (e) => {
  const v = parseInt((e.target as HTMLInputElement).value)
  if (v > max) { size = max; ($('size') as HTMLInputElement)!.value = size.toString() }
  else if (v < min) size = min
  else size = v;

  renderQrs()
})

$('input')!.addEventListener('input', (e: any) => {
  if (e.target && e.target.value) {
    values = e.target.value
    renderQrs()
  }
})