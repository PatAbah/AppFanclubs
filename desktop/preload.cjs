const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('fanclubs',{send:(type,data)=>ipcRenderer.send('fanclubs-command',{type,...data})});
ipcRenderer.on('fanclubs-native',(_event,detail)=>{window.dispatchEvent(new CustomEvent('fanclubs-native',{detail}))});
