type Point = { label: string; x: number; y: number };
type Chart = { title: string; x: string[]; y: string[]; quadrants: string[]; points: Point[] };
type ParsedChart = { chart: Chart } | { error: string; offset: number };

export const quadrantSnippet = `\`\`\`mermaid
quadrantChart
    title 观察与投入
    x-axis 低投入 --> 高投入
    y-axis 低参与 --> 高参与
    quadrant-1 重点探索
    quadrant-2 灵感积累
    quadrant-3 日常观察
    quadrant-4 持续练习
    "例子 A": [0.72, 0.81]
    "例子 B": [0.28, 0.60]
\`\`\`

<p align="center"><strong>图 1　观察与投入</strong></p>`;

// Split separators only outside quoted labels. Entirely line-based and never
// interprets a label as HTML, a CSS declaration or a Mermaid directive.
function labels(value: string, split = false): string[] | null {
  const result: string[] = [];
  let part = '', quote = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) {
      if (c === quote) quote = '';
      else if (c === '\\' && (value[i + 1] === quote || value[i + 1] === '\\')) part += value[++i];
      else part += c;
    } else if ((c === '"' || c === '“') && !part.trim()) {
      quote = c === '“' ? '”' : c;
    } else if (split && value.startsWith('-->', i)) {
      result.push(part.trim());
      part = '';
      i += 2;
    } else part += c;
  }
  result.push(part.trim());
  return quote || result.length > 2 || result.some(part => !part || Array.from(part).length > 100) ? null : result;
}

export function parseQuadrantChart(source: string): ParsedChart | null {
  const lines = source.split('\n');
  const header = lines.findIndex(line => line.trim() && !line.trimStart().startsWith('%%'));
  if (header < 0 || lines[header].trim() !== 'quadrantChart') return null;
  if (source.length > 14000) return { error: '四象限图源码过长，请拆成多张图。', offset: header };
  const chart: Chart = { title: '', x: [], y: [], quadrants: [], points: [] };
  const used = new Set<string>();
  for (let index = header + 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('%%')) continue;
    const fail = (error: string) => ({ error, offset: index });
    const directive = /^(title|[xy]-axis|quadrant-[1-4])\s+(.+)$/.exec(line);
    if (directive) {
      const [, kind, value] = directive;
      const parts = labels(value, kind.endsWith('-axis'));
      if (!parts) return fail('标题或轴标签格式有误，每个标签限 100 字符，请检查引号与箭头。');
      if (used.has(kind)) return fail(`${kind} 已定义，请保留一行。`);
      used.add(kind);
      if (kind === 'title') chart.title = parts[0];
      else if (kind === 'x-axis') chart.x = parts;
      else if (kind === 'y-axis') chart.y = parts;
      else chart.quadrants[Number(kind.at(-1)) - 1] = parts[0];
      continue;
    }
    const point = /^(.+?)\s*:\s*\[\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*\]$/.exec(line);
    if (!point) return fail('无法识别这一行。坐标请写成「名称: [0.3, 0.7]」。');
    const name = labels(point[1]);
    const x = Number(point[2]);
    const y = Number(point[3]);
    if (!name || ![x,y].every(value => value >= 0 && value <= 1)) return fail('点名需填写，横纵坐标须在 0 到 1 之间。');
    if (chart.points.length >= 40) return fail('单张图最多绘制 40 个数据点，请拆成多张图。');
    chart.points.push({ label: name[0], x, y });
  }
  return { chart };
}

type Box = { x: number; y: number; w: number; h: number };
const fontFamily = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const chartColors = ['#e8e9fa', '#e7f1fc', '#eaf4ee', '#fbefe5'];
const width = 720;
const ink = '#253854';
const cache = new Map<string,{src:string; alt:string; width:number; height:number}>();

export function drawQuadrantChart(source: string, chart: Chart) {
  const existing = cache.get(source);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器无法绘制图表。');
  const font = (size: number, bold = false) => `${bold ? '700 ' : ''}${size}px ${fontFamily}`;
  const wrap = (text: string, max: number, style: string) => {
    ctx.font = style;
    const lines: string[] = [];
    let line = '';
    for (const part of text.match(/\p{Script=Han}|[\p{L}\p{N}]+|./gu) || []) {
      const segments = ctx.measureText(part).width > max ? Array.from(part) : [part];
      for (const segment of segments) {
        if (line && ctx.measureText(line + segment).width > max) { lines.push(line.trimEnd()); line = ''; }
        line += line ? segment : segment.trimStart();
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (lines: string[], x: number, y: number, step: number, style: string, align: CanvasTextAlign = 'left', color = ink) => {
    ctx.font = style;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * step));
  };
  const titleFont = font(30, true);
  let title = wrap(chart.title, width - 72, titleFont);
  if (title.length === 2) {
    const balanced = wrap(chart.title, ctx.measureText(chart.title).width/2+32, titleFont);
    if (balanced.length === 2) title = balanced;
  }
  const vertical = chart.y.map(label => wrap(label, 108, font(20)));
  const horizontal = chart.x.map(label => wrap(label, 252, font(20)));
  const plot = { x: vertical.length ? 152 : 36, y: title.length ? 40 + title.length * 39 : 30, w: vertical.length ? 532 : 648, h: 500 };
  const half = plot.w / 2, bottom = plot.y + plot.h;
  const panels = [[half,0], [0,0], [0,250], [half,250]];
  const dots = chart.points.map(p => ({ ...p, px: plot.x + 10 + p.x * (plot.w - 20), py: bottom - 10 - p.y * (plot.h - 20) }));
  const quadrants = panels.map(([x,y], index) => ({ x: plot.x + x, y: plot.y + y, lines: wrap(chart.quadrants[index] || '', half - 30, font(20, true)) }));
  const occupied: Box[] = quadrants.filter(q => q.lines.length).map(q => ({ x:q.x+12, y:q.y+(dots.length ? 13 : 120-q.lines.length*12), w:half-24, h:q.lines.length*25+4 }));
  const circles = dots.map(dot => ({ x:dot.px-8, y:dot.py-8, w:16, h:16 }));
  const intersects = (a: Box, b: Box) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const legend: { number: number; label: string[]; dot: typeof dots[number] }[] = [];
  const placements = dots.map(dot => {
    const lines = wrap(dot.label, 204, font(21, true));
    ctx.font = font(21, true);
    const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + 16, h = lines.length * 24 + 8;
    if (lines.length <= 3) for (const gap of [11, 27, 51]) {
      for (const [dx,dy] of [[-w/2,gap], [-w/2,-gap-h], [gap,-h/2], [-gap-w,-h/2], [gap,gap], [-gap-w,gap], [gap,-gap-h], [-gap-w,-gap-h]]) {
        const x=dot.px+dx, y=dot.py+dy;
        const box = { x: Math.max(plot.x+3,Math.min(plot.x+plot.w-w-3,x)), y: Math.max(plot.y+3,Math.min(bottom-h-3,y)), w, h };
        if (occupied.some(b => intersects(box,b)) || circles.some(b => intersects(box,b))) continue;
        occupied.push(box);
        return { dot, lines, box };
      }
    }
    const number = legend.length + 1;
    legend.push({ number, label:wrap(dot.label, width-118, font(21)), dot });
    return null;
  });

  const legendY = bottom + 22 + Math.max(0,...horizontal.map(lines => lines.length * 25)) + 18;
  const height = legendY + legend.reduce((sum, entry) => sum + entry.label.length * 26 + 11, 0) + 12;
  const scale = height > 1600 ? 2 : 3;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale,scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,width,height);
  text(title, width/2, 24, 39, titleFont, 'center');
  panels.forEach(([x,y],index) => {
    ctx.fillStyle = chartColors[index];
    ctx.fillRect(plot.x+x,plot.y+y,half,250);
  });
  ctx.strokeStyle = '#788da9';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(plot.x,plot.y,plot.w,plot.h);
  ctx.beginPath();
  ctx.moveTo(plot.x+half,plot.y); ctx.lineTo(plot.x+half,bottom);
  ctx.moveTo(plot.x,plot.y+250); ctx.lineTo(plot.x+plot.w,plot.y+250);
  ctx.stroke();
  quadrants.forEach(q => text(q.lines,q.x+half/2,q.y+(dots.length ? 16 : 125-q.lines.length*12),25,font(20,true),'center','#4a5d78'));
  vertical.forEach((lines,index) => text(lines,plot.x-16,(index===0?bottom-28:plot.y+28) - lines.length*12,25,font(20),'right'));
  horizontal.forEach((lines,index) => text(lines,index===0?plot.x:plot.x+plot.w,bottom+15,25,font(20),index===0?'left':'right'));
  const circle = (x: number,y: number,r: number) => { ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle='#335b91';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke(); };
  for (const placement of placements) {
    if (!placement) continue;
    const { dot, box, lines } = placement;
    ctx.beginPath();ctx.moveTo(dot.px,dot.py);ctx.lineTo(Math.max(box.x,Math.min(box.x+box.w,dot.px)),Math.max(box.y,Math.min(box.y+box.h,dot.py)));
    ctx.lineWidth = 1.4;ctx.strokeStyle = '#6881a0';ctx.stroke();
    ctx.fillStyle = '#fffffff0';ctx.fillRect(box.x,box.y,box.w,box.h);
    text(lines,box.x+8,box.y+4,24,font(21,true));
  }
  dots.forEach(dot => circle(dot.px,dot.py,6));
  let rowY = legendY;
  for (const item of legend) {
    const { dot, number, label } = item;
    circle(dot.px,dot.py,12);
    text([String(number)],dot.px,dot.py-9,18,font(14,true),'center','#fff');
    text([`${number}.`],44,rowY,26,font(21,true));
    text(label,84,rowY,26,font(21));
    rowY += label.length*26+11;
  }
  const alt = [chart.title || '四象限图',chart.x.length ? `横轴：${chart.x.join(' 至 ')}` : '',chart.y.length ? `纵轴：${chart.y.join(' 至 ')}` : '',...chart.quadrants.filter(Boolean),...chart.points.map(dot => `${dot.label} (${dot.x}, ${dot.y})`)].filter(Boolean).join('；');
  const result = { src:canvas.toDataURL('image/png'), alt, width, height };
  canvas.width = 1;
  canvas.height = 1;
  cache.set(source,result);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return result;
}
