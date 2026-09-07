import { test, expect } from '@playwright/test';
async function open(page,fallback=true){
  if(fallback)await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto('/test/browser/fixture.html');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>Boolean(window.api));
  await page.evaluate(async()=>{
    document.body.innerHTML='<div id="draw" style="width:360px;height:240px;border-radius:16px;background:#112032;touch-action:none"></div>';
    window.light=api.brightenSurface(document.querySelector('#draw'),{color:'#55eeff',colorEnd:'#ff55c8',trail:true,trailLifetime:600,spotlight:false,press:false});
    await light.ready;
  });
  await expect.poll(()=>page.evaluate(()=>light._near)).toBe(true);
}

test('drag light paints a bounded trail, fades out, and respects cancellation',async({page})=>{
  await open(page);
  const box=await page.locator('#draw').boundingBox();
  await page.mouse.move(box.x+30,box.y+100);
  await page.mouse.down();
  await expect.poll(()=>page.evaluate(()=>light._traces.length)).toBe(1);
  await page.mouse.move(box.x+310,box.y+140,{steps:24});
  await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>light._traces.length)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>light._traces.length)).toBeLessThanOrEqual(12);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','true');
  expect(await page.evaluate(()=>{
    const data=light._context.getImageData(0,0,light._canvas.width,light._canvas.height).data;
    return data.some((value,index)=>index%4===3 && value>0);
  })).toBe(true);
  await expect.poll(()=>page.evaluate(()=>[light._traces.length,light.running])).toEqual([0,false]);
  await page.locator('#draw').dispatchEvent('pointerdown',{pointerType:'touch',pointerId:5,isPrimary:true,button:0,clientX:40,clientY:50});
  await expect.poll(()=>page.evaluate(()=>light._traces.length)).toBeGreaterThan(0);
  await page.locator('#draw').dispatchEvent('pointercancel',{pointerId:5,bubbles:true});
  await expect.poll(()=>page.evaluate(()=>[light._traces.length,light.running])).toEqual([0,false]);
});

test('sweeps finish, charge stays static, and reduced motion removes moving effects',async({page})=>{
  await open(page);
  await page.evaluate(()=>light.sweep({angle:180,duration:200}));
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>[light._sweep,light.running])).toEqual([null,false]);
  await page.evaluate(()=>light.setCharge(.65));
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(false);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','true');
  expect(await page.evaluate(()=>light.charge)).toBe(.65);
  await page.evaluate(()=>light.setCharge(99));
  expect(await page.evaluate(()=>light.charge)).toBe(1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>light._motion.matches)).toBe(true);
  await page.evaluate(()=>light.setCharge(0).sweep().ripple());
  expect(await page.evaluate(()=>[light._sweep,light._waves.length,light._traces.length])).toEqual([null,0,0]);
  await expect.poll(()=>page.evaluate(()=>[light._flash,light.running])).toEqual([null,false]);
});

test('surface groups respect order, cancellation, reduced motion and borrowed ownership',async({page})=>{
  await open(page);
  await page.evaluate(()=>{
    light.destroy();
    document.body.innerHTML='<div style="display:flex;gap:10px"><div class="cell" style="width:100px;height:100px"></div><div class="cell" style="width:100px;height:100px"></div><div class="cell" style="width:100px;height:100px"></div></div>';
    window.members=[...document.querySelectorAll('.cell')].map(el=>api.brightenSurface(el));
    window.group=api.createSurfaceGroup(members); window.order=[];
    members.forEach((member,index)=>{const original=member.flash.bind(member);member.flash=(kind)=>{order.push(index);return original(kind);};});
  });
  await expect.poll(()=>page.evaluate(()=>members.every(m=>m._near))).toBe(true);
  await page.evaluate(()=>group.burst({from:'end',stagger:100}));
  await expect.poll(()=>page.evaluate(()=>order)).toEqual([2,1,0]);
  await page.evaluate(()=>{order=[];group.burst({from:'start',stagger:120});group.cancel();});
  expect(await page.evaluate(()=>[group.pending,order])).toEqual([0,[0]]);
  await page.evaluate(()=>{group.burst({stagger:120});window.dispatchEvent(new Event('blur'));});
  expect(await page.evaluate(()=>group.pending)).toBe(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>members.every(m=>m._motion.matches))).toBe(true);
  await page.evaluate(()=>{order=[];group.burst({from:'center'});});
  expect(await page.evaluate(()=>[group.pending,order])).toEqual([0,[1,0,2]]);
  await page.evaluate(()=>{group.destroy();group.destroy();});
  expect(await page.evaluate(()=>members.every(m=>!m._destroyed))).toBe(true);
  await page.evaluate(()=>members.forEach(m=>m.destroy()));
  await expect(page.locator('bright-surface')).toHaveCount(0);
});

test('new shader effects retain HDR and two-color output',async({page},info)=>{
  test.skip(info.project.name!=='chromium','Actual GPU readback requires Chromium.');
  await open(page,false);
  await expect.poll(()=>page.evaluate(()=>light.mode)).toBe('hdr');
  const result=await page.evaluate(async()=>{
    const {device,pipeline}=light._gpu;
    device.pushErrorScope('validation');
    const data=new Float32Array(light._uniforms.length);
    data.set([32,32,2,2,1,0,0,12]);data.set([0,0,1,1],32); // red to blue
    data.set([.5,1,1,0],36); // vertical scan through the center
    data.set([.5,1,0,0],40); // charge halfway
    data.set([8,8,3,1,24,24,3,1],44); // diagonal trail
    const buffer=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(buffer,0,data);
    const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer}}]});
    const texture=device.createTexture({size:[32,32],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    const readback=device.createBuffer({size:256*32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const command=device.createCommandEncoder(),pass=command.beginRenderPass({colorAttachments:[{view:texture.createView(),clearValue:[0,0,0,0],loadOp:'clear',storeOp:'store'}]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(3);pass.end();command.copyTextureToBuffer({texture},{buffer:readback,bytesPerRow:256},[32,32]);device.queue.submit([command.finish()]);
    await readback.mapAsync(GPUMapMode.READ);const pixels=new Uint16Array(readback.getMappedRange());
    const left=Array.from(pixels.slice(8*128+8*4,8*128+8*4+4)),right=Array.from(pixels.slice(24*128+24*4,24*128+24*4+4));
    readback.unmap();readback.destroy();texture.destroy();buffer.destroy();
    return {left,right,error:(await device.popErrorScope())?.message||null};
  });
  expect(result.error).toBeNull();
  expect(result.left[0]).toBeGreaterThan(0x3c00);expect(result.right[2]).toBeGreaterThan(0x3c00);
  expect(result.left[0]).toBeGreaterThan(result.left[2]);expect(result.right[2]).toBeGreaterThan(result.right[0]);
  await page.evaluate(()=>{light.sweep().setCharge(.4);api.configureBrightpixels({enabled:false});});
  expect(await page.evaluate(()=>light.mode)).toBe('fallback');
  await page.evaluate(()=>light.destroy());
  expect(await page.evaluate(()=>[light.running,light._sweep,light._traces.length,light._gpu])).toEqual([false,null,0,null]);
});

test('expanded demo works on phones, with keyboard switches and palette changes',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto('/surfaces.html');
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('#group-burst').click();
  await expect(page.locator('#burst-status')).toContainText('NEON SALVO 01');
  await page.locator('#light-palette').selectOption('inferno');
  await page.locator('#burst-direction').selectOption('end');
  if(info.project.name==='chromium')await page.screenshot({path:'test-results/surface-expansion-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#group-burst').click();
  await expect(page.locator('#burst-status')).toContainText('NEON SALVO 02');
  await page.locator('#energy-charge').evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'65');el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('.charge-readout output')).toHaveText('65%');
  await page.locator('#arm-neon').focus();await page.keyboard.press('Space');
  await expect(page.locator('#arm-neon')).toHaveAttribute('aria-checked','true');
  await expect(page.locator('.charge-readout output')).toHaveText('100%');
  await page.keyboard.press('Space');
  await expect(page.locator('#arm-neon')).toHaveAttribute('aria-checked','false');
  await expect(page.locator('.charge-readout output')).toHaveText('0%');
  await page.locator('#sweep-light').click();
  await page.locator('#reverse-sweep').click();
  await page.locator('#clear-trails').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(info.project.name==='chromium')await page.screenshot({path:'test-results/surface-expansion-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
