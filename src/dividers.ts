export const dividerOptions=[['fine','细线留白'],['double','刊物双线'],['dots','点点节奏'],['diamond','菱形题记'],['leaf','草木手记'],['orbit','星轨分隔'],['wave','水波纹'],['pixel','像素刻度']] as const;
export function dividerSVG(kind:string){
 const lines='<path d="M12 16h112m72 0h112" opacity=".45"/>';
 const shapes:Record<string,string>={
  fine:'<path d="M32 16h256" opacity=".5"/>',
  double:'<path d="M20 12h280M44 20h232"/>',
  dots:[116,138,160,182,204].map((x,i)=>`<circle cx="${x}" cy="16" r="${i===2?3:2}" fill="currentColor"/>`).join(''),
  diamond:lines+'<path d="m160 8 8 8-8 8-8-8z" fill="currentColor"/><circle cx="140" cy="16" r="1.5"/><circle cx="180" cy="16" r="1.5"/>',
  leaf:lines+'<path d="M148 24q5-15 23-17 0 16-22 15m0 0 17-11m-10 6v-5m0 5h8"/>',
  orbit:lines+'<ellipse cx="160" cy="16" rx="20" ry="6" transform="rotate(-20 160 16)"/><circle cx="160" cy="16" r="9"/><circle cx="180" cy="9" r="2" fill="currentColor"/>',
  wave:'<path d="M100 13q10-9 20 0t20 0 20 0 20 0 20 0 20 0M100 21q10-9 20 0t20 0 20 0 20 0 20 0 20 0"/>',
  pixel:'<path d="M72 16h54m68 0h54" stroke-dasharray="4 4"/><path d="M144 12h8v8h-8zm12-4h8v16h-8zm12 4h8v8h-8z" fill="currentColor" stroke="none"/>',
 };
 return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="32" viewBox="0 0 320 32" style="display:block;width:100%;height:32px;max-width:100%" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">${shapes[kind]||shapes.fine}</svg>`;
}
