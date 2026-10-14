// WeChat mode preserves link labels and collects unique external URLs at the
// end. This is a presentation transform; the original Markdown is unchanged.
export function appendReferences(article:HTMLElement){
  const references:{url:string;label:string}[]=[],numbers=new Map<string,number>();
  for(const link of article.querySelectorAll<HTMLAnchorElement>('a[href]')){
    const url=link.getAttribute('href')||'';if(!/^https?:\/\//i.test(url))continue;
    let number=numbers.get(url);
    if(!number){number=references.length+1;numbers.set(url,number);references.push({url,label:link.textContent?.trim()||url});}
    const text=document.createElement('span');text.className='reference-label';text.append(...link.childNodes);
    const mark=document.createElement('sup');mark.className='reference-marker';mark.textContent='[参'+number+']';mark.setAttribute('aria-hidden','true');text.append(mark);link.replaceWith(text);
  }
  if(!references.length)return;
  const section=document.createElement('section');section.className='article-references';
  section.style.cssText='clear:both;margin:36px 0 0;padding:18px 0 0;border-top:1px solid #aab4ad;font-size:12px;line-height:1.8;text-indent:0;';
  const title=document.createElement('strong');title.textContent='参考链接';title.style.cssText='display:block;font-size:15px;margin-bottom:12px;';section.append(title);
  references.forEach((reference,i)=>{const item=document.createElement('p');item.style.cssText='margin:0 0 12px;text-indent:0;overflow-wrap:anywhere;word-break:break-all;';const label=document.createElement('span');label.textContent=`[参${i+1}] ${reference.label}`;label.style.display='block';const address=document.createElement('span');address.textContent=reference.url;address.style.cssText='display:block;font-size:11px;';item.append(label,address);section.append(item);});
  article.append(section);
}
