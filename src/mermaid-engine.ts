import mermaid from 'mermaid';

// This entry only runs inside the isolated, network-disabled renderer frame.
mermaid.initialize({
  startOnLoad: false, securityLevel: 'strict', htmlLabels: false,
  suppressErrorRendering: true, maxTextSize: 30000, maxEdges: 300,
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  flowchart: {wrappingWidth:260},
  journey: {textPlacement:'tspan'},
  secure: ['secure','securityLevel','startOnLoad','suppressErrorRendering','maxTextSize','maxEdges','dompurifyConfig','htmlLabels','themeCSS'],
});

window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data !== 'paper-mermaid-connect' || event.ports.length !== 1) return;
  const port = event.ports[0];
  port.onmessage = async ({data}) => {
    if (typeof data?.id !== 'number' || typeof data.source !== 'string') return;
    const scratch = document.createElement('div');
    document.body.append(scratch);
    try {
      const {svg} = await mermaid.render(`paper-mermaid-${data.id}`, data.source, scratch);
      port.postMessage({id:data.id, svg});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      port.postMessage({id:data.id, error:message.slice(0,600)});
    } finally {
      scratch.remove();
    }
  };
  port.postMessage({ready:true});
}, {once:true});
