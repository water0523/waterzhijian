import {download} from './files';

type SavePicker=(options:unknown)=>Promise<{createWritable:()=>Promise<{write:(blob:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>;
// Call from the user's click, so a save dialog retains browser user activation.
export async function saveImageFile(blob:Blob,name:string):Promise<'saved'|'downloaded'|'cancelled'>{
  const picker=(window as Window&{showSaveFilePicker?:SavePicker}).showSaveFilePicker;
  if(picker){
    let handle;
    try{handle=await picker.call(window,{suggestedName:name,types:[{description:blob.type==='image/png'?'PNG 图片':'ZIP 图片包',accept:{[blob.type]:[blob.type==='image/png'?'.png':'.zip']}}]});}
    catch(error){
      if(error instanceof DOMException&&error.name==='AbortError')return 'cancelled';
      if(!(error instanceof DOMException&&error.name==='SecurityError'))throw error;
    }
    if(handle){
      const writable=await handle.createWritable();
      try{await writable.write(blob);await writable.close();}catch(error){await writable.abort().catch(()=>{});throw error;}
      return 'saved';
    }
  }
  download(blob,name,blob.type);return 'downloaded';
}
