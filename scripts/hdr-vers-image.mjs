import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { FloatType } from 'three'
import fs from 'fs'
const [inp, out] = process.argv.slice(2)
const l = new HDRLoader(); l.setDataType(FloatType)
const buf = fs.readFileSync(inp)
const r = l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const { width, height, data } = r
const px = Buffer.alloc(width * height * 3)
// exposition + tone mapping doux (Reinhard) + sRGB
for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) {
  let v = data[i * 4 + c] * 0.9; v = v / (1 + v * 0.35); v = Math.min(1, v)
  v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  px[i * 3 + c] = Math.round(v * 255)
}
fs.writeFileSync(out, px); console.log(width, height)
