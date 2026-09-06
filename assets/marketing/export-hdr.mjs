// Bake BrightPixels' image highlight curve into a PQ HDR PNG.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const source=new URL('./brightpixels-linkedin-source.png',import.meta.url).pathname;
const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',source]));
const {width:w,height:h}=info.streams[0];
const rgb=execFileSync('ffmpeg',['-v','error','-i',source,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:64*1024*1024});
const scan=Buffer.alloc(h*(w*6+1));
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const pq=n=>{const p=(n/10000)**(2610/16384);return ((3424/4096+(2413/128)*p)/(1+(2392/128)*p))**(2523/32);};
let peak=0,total=0,above=0;
for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
 const i=(y*w+x)*3; const r=linear(rgb[i]/255),g=linear(rgb[i+1]/255),b=linear(rgb[i+2]/255);
 const l=.2126*r+.7152*g+.0722*b;const t=Math.max(0,Math.min(1,(l-.55)/.45));const highlight=t*t*(3-2*t);
 const gain=1+7*highlight*highlight; // Same smoothstep + squared highlight as index.js; intensity 8.
 // Linear sRGB to linear BT.2020, 203-nit reference white.
 const values=[.627404*r+.329283*g+.043313*b,.069097*r+.91954*g+.011362*b,.016391*r+.088013*g+.895595*b].map(v=>v*gain*203);
 peak=Math.max(peak,...values);total+=l*gain*203;if(l*gain*203>203)above++;
 values.forEach((v,c)=>scan.writeUInt16BE(Math.round(pq(v)*65535),y*(w*6+1)+1+x*6+c*2));
}
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=16;ihdr[9]=2;
const clli=Buffer.alloc(8);clli.writeUInt32BE(Math.ceil(peak*10000));clli.writeUInt32BE(Math.ceil(total/(w*h)*10000),4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('cICP',Buffer.from([9,16,0,1])),chunk('cLLI',clli),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
writeFileSync(new URL('./brightpixels-linkedin-hdr.png',import.meta.url),png);
console.log(JSON.stringify({width:w,height:h,bitDepth:16,primaries:'BT.2020',transfer:'PQ',referenceWhiteNits:203,peakNits:peak,pixelsAboveReferenceWhite:above,bytes:png.length},null,2));
