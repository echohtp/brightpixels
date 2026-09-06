import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const w=1500,h=700,scan=Buffer.alloc(h*(w*6+1));
const lin=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const pq=n=>{const p=(n/10000)**(2610/16384);return ((3424/4096+(2413/128)*p)/(1+(2392/128)*p))**(2523/32);};
const orange=lin(.35);
const srgb=[.627404+.329283*orange,.069097+.91954*orange,.016391+.088013*orange];
const p3=[.753833+.198597*orange,.045744+.941777*orange,-.00121+.017602*orange];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const col=Math.floor(x/500),dx=x%500-250,dy=y-350;
 const inside=Math.abs(dx)<200&&Math.abs(dy)<260;
 const rgb=inside?(col===0?srgb:p3).map(v=>v*203*(col===2?4:1)):[1.5,1.5,1.5];
 rgb.forEach((v,c)=>scan.writeUInt16BE(Math.round(pq(Math.max(0,v))*65535),y*(w*6+1)+1+x*6+c*2));
}
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(t,d){const b=Buffer.alloc(d.length+12);b.writeUInt32BE(d.length);b.write(t,4);d.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;}
const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=16;ih[9]=2;
writeFileSync(new URL('./wide-gamut-comparison.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('cICP',Buffer.from([9,16,0,1])),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]));
