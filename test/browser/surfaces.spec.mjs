import { test, expect } from '@playwright/test';
async function open(page, fallback = true) {
  if (fallback) await page.addInitScript(() => Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto('/test/browser/fixture.html');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>Boolean(window.api));
  await page.evaluate(async()=>{
    document.body.innerHTML='<div id="surface" style="width:320px;height:220px;border:2px solid #345;border-radius:16px;padding:25px;background:#101b25"><button id="action">Action</button><input id="typing"><button id="disabled" disabled>Disabled</button></div><button id="external">External</button>';
    document.body.style.margin='20px';
    window.light=api.brightenSurface(document.querySelector('#surface'));
    await light.ready;
  });
  await expect.poll(()=>page.evaluate(()=>light._near)).toBe(true);
}

test('spotlight follows the pointer, paints light and sleeps between events',async({page})=>{
  await open(page);
  const box=await page.locator('#surface').boundingBox();
  await page.mouse.move(box.x+210,box.y+140);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','true');
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(false);
  expect(await page.evaluate(()=>light._context.getImageData(210*light._scale,140*light._scale,1,1).data[3])).toBeGreaterThan(0);
  expect(await page.evaluate(()=>api.brightenSurface(light.target)===light)).toBe(true);
  await expect(page.locator('bright-surface')).toHaveCount(1);
  await expect(page.locator('bright-surface')).toHaveCSS('pointer-events','none');
  await page.mouse.move(5,5);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','false');
  await page.evaluate(()=>{light.target.style.width='280px';});
  await expect.poll(()=>page.evaluate(()=>light._width)).toBe(334); // content width + padding + borders
  await page.evaluate(()=>{light.destroy();light.destroy();});
  await expect(page.locator('bright-surface')).toHaveCount(0);
  expect(await page.locator('#surface').evaluate(el=>el.style.position)).toBe('');
});

test('touch origin, scroll cancellation, bounded waves and native actions',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const rect=light.overlay.getBoundingClientRect();
    light.target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'touch',pointerId:7,isPrimary:true,clientX:rect.left+80,clientY:rect.top+110}));
    return [light._waves[0].x,light._waves[0].y,light._pressed];
  });
  expect(result).toEqual([80,110,7]);
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:7})));
  expect(await page.evaluate(()=>[light._waves.length,light._pointer,light._pressed])).toEqual([0,null,null]);
  await page.evaluate(()=>{for(let i=0;i<100;i++)light.ripple();});
  expect(await page.evaluate(()=>light._waves.length)).toBe(4);
  await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));
  await expect.poll(()=>page.evaluate(()=>[light._waves.length,light.running])).toEqual([0,false]);
  await page.evaluate(()=>{window.clicks=0;document.querySelector('#action').onclick=()=>window.clicks++;});
  await page.locator('#action').click();
  expect(await page.evaluate(()=>window.clicks)).toBe(1);
  await page.evaluate(()=>light.cancel());
  await page.locator('#typing').focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(()=>light._flash)).toBeNull();
  await page.locator('#action').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.clicks)).toBe(2);
  await page.evaluate(()=>{
    light.cancel(); document.querySelector('#disabled').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'touch',pointerId:2,isPrimary:true}));
  });
  expect(await page.evaluate(()=>light._flash)).toBeNull();
});

test('linked outcomes, loading and selection remain independent of application state',async({page})=>{
  await open(page);
  await page.evaluate(()=>{window.unlink=light.link(document.querySelector('#external'),{kind:'success'});});
  await page.locator('#external').click();
  expect(await page.evaluate(()=>light._cssColor)).toBe('rgb(68,239,165)');
  await page.evaluate(()=>{unlink();light.cancel();});
  await page.locator('#external').click();
  expect(await page.evaluate(()=>light._flash)).toBeNull();
  await page.evaluate(()=>light.setLoading());
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(true);
  await page.evaluate(()=>light.setLoading(false).select());
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(false);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','true');
  expect(await page.locator('#surface').getAttribute('aria-selected')).toBeNull();
  await page.evaluate(()=>{light.cancel();});
  expect(await page.evaluate(()=>light.selected)).toBe(true);
  await page.evaluate(()=>light.select(false));
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','false');
});

test('reduced motion, hidden pages, offscreen surfaces and disabled effects stop work',async({page})=>{
  await open(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>light._motion.matches)).toBe(true);
  await page.evaluate(()=>light.setLoading().ripple().flash());
  expect(await page.evaluate(()=>light._waves.length)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>light.running)).toBe(false);
  await expect(page.locator('bright-surface')).toHaveAttribute('data-active','true');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.evaluate(()=>[light.running,light._canvas.style.visibility])).toEqual([false,'hidden']);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.evaluate(()=>light._canvas.style.visibility)).toBe('visible');
  await page.evaluate(()=>light.target.style.marginTop='3000px');
  await expect.poll(()=>page.evaluate(()=>[light._near,light.running,light._canvas.style.visibility])).toEqual([false,false,'hidden']);
  await page.evaluate(()=>light.target.style.marginTop='0');
  await expect.poll(()=>page.evaluate(()=>light._near)).toBe(true);
  await page.evaluate(()=>light.update({enabled:false}));
  expect(await page.evaluate(()=>[light.running,light._canvas.style.visibility])).toEqual([false,'hidden']);
  await page.evaluate(()=>light.update({enabled:true}));
  await expect.poll(()=>page.evaluate(()=>light._canvas.style.visibility)).toBe('visible');
});

test('detachment cleans resources and positioning coexists with existing edge effects',async({page})=>{
  await open(page);
  await page.evaluate(()=>{[window.edge]=api.brightenEdges(light.target);light.destroy();});
  expect(await page.locator('#surface').evaluate(el=>el.style.position)).toBe('relative');
  await page.evaluate(()=>edge.destroy());
  expect(await page.locator('#surface').evaluate(el=>el.style.position)).toBe('');
  await page.evaluate(()=>{window.light=api.brightenSurface(document.querySelector('#surface'),{loading:true});light.link(document.querySelector('#external'));light.target.remove();});
  expect(await page.evaluate(()=>[light.running,light._gpu,light._links.size,light._destroyed])).toEqual([false,null,0,true]);
  await page.locator('#external').click();
  await expect(page.locator('bright-surface')).toHaveCount(0);
});

test('surface shader writes HDR pixels and releases GPU resources across settings and loss',async({page},info)=>{
  test.skip(info.project.name!=='chromium','WebGPU readback runs in Chromium.');
  await open(page,false);
  await expect.poll(()=>page.evaluate(()=>light.mode)).toBe('hdr');
  const result=await page.evaluate(async()=>{
    const {device,pipeline}=light._gpu;
    device.pushErrorScope('validation');
    const uniforms=new Float32Array(light._uniforms.length);
    uniforms.set([32,32,3,2,1,.3,.1,8,16,16,24,1]);
    const buffer=device.createBuffer({size:uniforms.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(buffer,0,uniforms);
    const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer}}]});
    const texture=device.createTexture({size:[32,32],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    const readback=device.createBuffer({size:256*32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const command=device.createCommandEncoder();
    const pass=command.beginRenderPass({colorAttachments:[{view:texture.createView(),clearValue:[0,0,0,0],loadOp:'clear',storeOp:'store'}]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(3);pass.end();
    command.copyTextureToBuffer({texture},{buffer:readback,bytesPerRow:256},[32,32]);device.queue.submit([command.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const pixel=Array.from(new Uint16Array(readback.getMappedRange()).slice(16*128+16*4,16*128+16*4+4));
    readback.unmap();readback.destroy();texture.destroy();buffer.destroy();
    return {pixel,error:(await device.popErrorScope())?.message||null};
  });
  expect(result.error).toBeNull();expect(result.pixel[0]).toBeGreaterThan(0x3c00);expect(result.pixel[3]).toBeLessThanOrEqual(0x3c00);
  await page.evaluate(()=>{light.setLoading();api.configureBrightpixels({enabled:false});});
  expect(await page.evaluate(()=>[light.mode,light._gpu,light.fallbackReason])).toEqual(['fallback',null,'disabled']);
  await page.evaluate(async()=>{api.configureBrightpixels({enabled:true,brightness:0});await light.ready;});
  await expect.poll(()=>page.evaluate(()=>light.mode)).toBe('hdr');
  await expect.poll(()=>page.evaluate(()=>light._uniforms[7])).toBe(1);
  await page.evaluate(()=>light._gpu.device.destroy());
  await expect.poll(()=>page.evaluate(()=>light.fallbackReason)).toBe('device-lost');
  await page.evaluate(()=>{api.configureBrightpixels({enabled:true});light.destroy();});
  await page.evaluate(async()=>{await light.ready;});
  await expect(page.locator('bright-surface')).toHaveCount(0);
});

test('React StrictMode, live props, host changes and unmount keep one working surface',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto('/test/browser/react-surface-fixture.html');
  await page.waitForFunction(()=>Boolean(window.renderSurface));
  await page.evaluate(()=>renderSurface({loading:true}));
  await expect(page.locator('bright-surface')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>surfaceRef.current?.controller?.loading)).toBe(true);
  await page.evaluate(()=>{window.original=surfaceRef.current.controller;renderSurface({color:'#ff0000',selected:true});});
  await expect.poll(()=>page.evaluate(()=>surfaceRef.current?.controller?.selected)).toBe(true);
  expect(await page.evaluate(()=>surfaceRef.current.controller===original)).toBe(true);
  expect(await page.evaluate(()=>original.loading)).toBe(false);
  await page.evaluate(()=>{original.flash('success');renderSurface({color:'#ff0000',selected:true});});
  await expect.poll(()=>page.evaluate(()=>original._options.color)).toBe('#ff0000');
  expect(await page.evaluate(()=>original._cssColor)).toBe('rgb(68,239,165)');
  await page.locator('#react-action').click();
  expect(await page.evaluate(()=>window.actions)).toBe(1);
  await page.evaluate(()=>renderSurface({intensity:3},'article'));
  await expect(page.locator('article bright-surface')).toHaveCount(1);
  expect(await page.evaluate(()=>original._destroyed)).toBe(true);
  await page.evaluate(()=>{window.last=surfaceRef.current.controller;unmountSurface();});
  await expect(page.locator('bright-surface')).toHaveCount(0);
  expect(await page.evaluate(()=>[last._destroyed,last.running])).toEqual([true,false]);
});

test('public demo responds on desktop and phone without overflow or script errors',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto('/surfaces.html#feedback');
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('#success').click();
  await expect(page.locator('#surface-status')).toContainText('Approved');
  await page.locator('#send-signal').click();
  await expect(page.locator('#signal-status')).toContainText('Signal received');
  await page.locator('#loading-toggle').click();
  await expect(page.locator('#loading-stage bright-surface')).toHaveAttribute('data-active','true');
  await page.locator('#loading-toggle').click();
  await page.locator('#select').click();
  if(info.project.name==='chromium')await page.screenshot({path:'test-results/surfaces-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#error').click();
  await expect(page.locator('#surface-status')).toContainText('Denied');
  await page.locator('#effects-enabled').uncheck();
  await expect.poll(()=>page.locator('bright-surface canvas').evaluateAll(els=>els.every(el=>el.style.visibility==='hidden'))).toBe(true);
  await page.locator('#effects-enabled').check();
  await page.locator('#hdr-enabled').uncheck();
  await page.locator('#success').click();
  await expect(page.locator('#surface-status')).toContainText('Approved');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(info.project.name==='chromium')await page.screenshot({path:'test-results/surfaces-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
