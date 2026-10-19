import assert from 'node:assert/strict';
// Project the opaque asset pixels through its CSS transform; transparent padding
// and the soft drop shadow must not count as the hat covering a control glyph.
export async function checkHatClearance(page,dir,channel){
 const measurements=[];
 for(const [width,height]of [[1280,800],[1366,900],[1440,900],[1920,1080],[1920,800]]){
  await page.setViewportSize({width,height});await page.keyboard.press('Alt+2');
  for(const night of [false,true]){
   if((await page.locator('body').getAttribute('data-appearance')==='night')!==night)await page.click('#night-button');await page.waitForTimeout(200);
   const result=await page.locator('.witch-corner-hat').evaluate(hat=>{
    const img=hat.querySelector('img'),w=hat.clientWidth,h=hat.clientHeight,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;ctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);const pixels=ctx.getImageData(0,0,w,h).data,style=getComputedStyle(hat),matrix=new DOMMatrix(style.transform),[ox,oy]=style.transformOrigin.split(' ').map(parseFloat),parent=hat.offsetParent.getBoundingClientRect();
    const controls=[...document.querySelectorAll('#writing-panel-close,.header-social-link,#writing-panel [data-panel-tab]')].map(n=>{const r=n.getBoundingClientRect();return{id:n.id,left:r.left+4,right:r.right-4,top:r.top+4,bottom:r.bottom-4,pixels:0};});const panel=document.getElementById('writing-panel').getBoundingClientRect(),corner={left:panel.right-12,right:Math.min(innerWidth,panel.right+6),top:panel.top-4,bottom:panel.top+14,pixels:0};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(pixels[(y*w+x)*4+3]<192)continue;const p=new DOMPoint(x-ox,y-oy,0,1).matrixTransform(matrix),px=p.x/p.w+ox+hat.offsetLeft+parent.left,py=p.y/p.w+oy+hat.offsetTop+parent.top;for(const t of [...controls,corner])if(px>=t.left&&px<t.right&&py>=t.top&&py<t.bottom)t.pixels++;}
    return{width:w,height:h,top:parseFloat(style.top),controls,corner};
   });
   measurements.push({viewport:{width,height},night,...result});
   for(const c of result.controls)assert.equal(c.pixels,0,`${width}×${height} ${night?'night':'day'} hat overlaps ${c.id}`);assert.ok(result.corner.pixels>0,'hat still covers the outer panel corner');assert.ok(result.width<=104);assert.ok(result.top<=50);
   await page.screenshot({path:`${dir}/clearance-${width}-${height}-${night?'night':'day'}.png`,clip:{x:width-460,y:0,width:460,height:205}});
   await page.click('#writing-panel-close');assert.equal(await page.locator('#writing-panel').isVisible(),false);await page.keyboard.press('Alt+2');
  }
 }
 for(const skin of ['witch-light','water']){await page.keyboard.press('Alt+6');await page.click('#panel-skin');await page.click(`[data-ui-skin-choice="${skin}"]`);await page.click('#modal-close');assert.equal(await page.locator('.witch-corner-hat').isVisible(),false);}
 return measurements;
}
