export async function pickerChoose(page,kind,value,prefix='inline'){
 if(kind==='effect'&&['bold','italic','underline','wave','strike'].includes(value)){await page.locator(`.format-toolbar [data-format="${value}"]`).click();await page.waitForTimeout(230);return;}
 const id=kind==='font'?(prefix==='inline'?'inline-style-button':'selection-style-button'):`${prefix}-${kind}-button`;
 await page.click('#'+id);await page.waitForSelector('#quick-popover',{timeout:2000}).catch(async()=>{throw new Error('Dropdown did not open: '+JSON.stringify(await page.evaluate(()=>({toast:document.getElementById('toast').textContent,source:JSON.parse(localStorage.getItem('paper-recovery')).markdown,selection:getSelection()?.toString()}))));});await page.click(`#quick-popover [data-inline-choice="${value}"]`);await page.waitForTimeout(230);
}
export async function pickerSize(page,value){await page.click('#inline-size-button');await page.locator('#inline-size').fill(String(value));await page.locator('#inline-size').press('Enter');await page.waitForTimeout(230);}
export async function pickerColor(page,value){await page.click('#inline-color-button');await page.locator('#inline-color').evaluate((input,color)=>{input.value=color;input.dispatchEvent(new Event('change',{bubbles:true}));},value);await page.waitForTimeout(230);}
