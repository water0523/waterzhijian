import {inspectWriting as inspect} from './writing-tools';
import {inspectComponentStructure as components} from './component-check';
// Only the last document is retained. Consumers receive copies, not mutable cache entries.
let source:string|undefined,writing:ReturnType<typeof inspect>|undefined,structure:ReturnType<typeof components>|undefined;
function select(text:string){if(text!==source){source=text;writing=undefined;structure=undefined;}}
export function inspectWriting(text:string){select(text);writing??=inspect(text);return writing.map(i=>({...i}));}
export function inspectComponentStructure(text:string){select(text);structure??=components(text);return structure.map(i=>({...i}));}
