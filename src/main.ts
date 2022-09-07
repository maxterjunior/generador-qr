import './style.css'
import typescriptLogo from './typescript.svg'
import QR from 'qrcode'

const $ = (selector: string) => document.getElementById(selector)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="header">
      <h1>Generador de QRs</h1>
    </div>

    <input class="input" type="text" id="input" placeholder="Escribe algo">

    <div class="card" id="output" >
    </div>

    <div class="footer">
      <p>❤ por <a href="https://github.com/maxterjunior">Mj.asm</a></p>
    </div>
      
  </div>
`

$('input')!.addEventListener('input', (e: any) => {
  if (e.target && e.target.value) {
    const values = e.target.value.split(' ').filter((v: string) => v)
    $('output')!.innerHTML = ''
    values.forEach((value: string) => {
      const canvas = document.createElement('canvas')
      QR.toCanvas(canvas, value,)
      $('output')!.appendChild(canvas)
    })
  }
})