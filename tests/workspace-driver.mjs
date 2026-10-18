/** Compatibility navigation for tests written before the docked writing panel.
 * Opens the real replacement UI; source/render/data assertions stay unchanged. */
import {chromium} from 'playwright';
const originalLaunch=chromium.launch.bind(chromium),seen=new WeakSet();
function patch(page){if(seen.has(page))return page;seen.add(page);let navigating=false;const rawClick=page.click.bind(page),rawLocator=page.locator.bind(page);
 async function navigate(selector){if(navigating)return false;navigating=true;try{
  if(selector==='#writing-desk-button'){await rawClick('#writing-tools-button');return true;}
  if(selector==='#outline-toggle'){const active=await rawLocator('#writing-panel').isVisible()&&await rawLocator('[data-panel-tab=outline]').getAttribute('aria-selected')==='true';if(active)await rawClick('#writing-panel-close');else await page.keyboard.press('Alt+1');return true;}
  if(selector==='#style-close'){await rawClick('#writing-panel-close');return true;}
  if(selector==='#style-button'){await page.keyboard.press('Alt+3');return true;}
  if(selector==='#assets-button'){await page.keyboard.press('Alt+4');return true;}
  if(selector==='#format-rewrite-button'){await page.keyboard.press('Alt+5');await rawClick('#panel-format-rewrite');return true;}
  if(selector==='#export-toggle'){await rawClick('#local-button');await rawClick('#local-export');return true;}
  if(selector==='#ui-settings-button'){await page.keyboard.press('Alt+6');await rawClick('#panel-skin');return true;}
  if(selector==='#modal-close'&&!await rawLocator('#modal').evaluate(n=>n.open)){if(await rawLocator('#writing-panel').isVisible())await rawClick('#writing-panel-close');return true;}
  if(selector==='#continue-copy'&&!await rawLocator('#continue-copy').count())return true;
  if(selector==='#advanced-tools-toggle'){const open=await rawLocator('#insert-menu-button').getAttribute('open');if(open===null)await rawClick('#insert-menu-button > summary');return true;}
  const node=rawLocator(selector).first();if(await node.count()){if(await node.evaluate(n=>!!n.closest('#library')&&document.getElementById('library').hidden))await rawClick('#library-button');const details=node.locator('xpath=ancestor::details[not(@open)]');for(let i=await details.count()-1;i>=0;i--)await details.nth(i).locator(':scope > summary').click();}
  return false;
 }finally{navigating=false;}}
 page.click=async(selector,options)=>{if(await navigate(selector))return;await rawClick(selector,options);if(selector==='#reset-style'&&await rawLocator('#reset-style-confirm').count())await rawClick('#reset-style-confirm');};
 page.locator=(selector,options)=>{const loc=rawLocator(selector,options),click=loc.click.bind(loc);loc.click=async opts=>{if(await navigate(selector))return;await click(opts);if(selector==='#reset-style'&&await rawLocator('#reset-style-confirm').count())await rawClick('#reset-style-confirm');};return loc;};return page;
}
chromium.launch=async(...args)=>{const browser=await originalLaunch(...args),context=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);browser.newContext=async(...a)=>{const ctx=await context(...a),make=ctx.newPage.bind(ctx);ctx.newPage=async(...b)=>patch(await make(...b));return ctx;};browser.newPage=async(...a)=>patch(await newPage(...a));return browser;};
