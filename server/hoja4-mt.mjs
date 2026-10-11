import sharp from "sharp"; import fs from "node:fs";
const [dir, out, ...grupos] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
let n = 0;
for (const g of grupos) {
  const fs_ = g.split(",");
  const comps = []; 
  for (let i = 0; i < fs_.length; i++) {
    const buf = await sharp(`${dir}/${fs_[i].replace(".dc.html", ".png")}`).resize(700).toBuffer();
    comps.push({input: buf, left: (i % 2) * 710, top: Math.floor(i / 2) * 1000});
  }
  await sharp({create: {width: 1410, height: 2000, channels: 3, background: "#888"}}).composite(comps).jpeg({quality: 72}).toFile(`${out}/g${++n}.jpg`);
}
