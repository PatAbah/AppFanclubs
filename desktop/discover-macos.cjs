const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
const iconCache=new Map();
async function appIcon(bundle,info){
 const value=info.CFBundleIconFile||info.CFBundleIconName;
 if(typeof value!=='string'||path.basename(value)!==value)return '';
 const file=path.join(bundle,'Contents','Resources',path.extname(value)?value:value+'.icns');
 try{
  const stat=await fs.stat(file),key=file+':'+stat.mtimeMs;
  if(iconCache.has(key))return iconCache.get(key);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'appfanclubs-icon-'));
  try{
   const out=path.join(directory,'icon.png');
   await execFile('/usr/bin/sips',['-s','format','png','-Z','64',file,'--out',out],{timeout:10000,maxBuffer:1024*1024});
   const bytes=await fs.readFile(out);const icon=bytes.length<175000?'data:image/png;base64,'+bytes.toString('base64'):'';
   iconCache.set(key,icon);return icon;
  }finally{await fs.rm(directory,{recursive:true,force:true});}
 }catch{return '';}
}
async function discoverMacApps(){
 const bundles=[],warnings=[];
 async function walk(directory,depth=0){
  let entries;
  try{entries=await fs.readdir(directory,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')warnings.push('An Applications folder could not be read.');return;}
  for(const entry of entries){
   const file=path.join(directory,entry.name);
   if(entry.name.endsWith('.app'))bundles.push(file);
   else if(entry.isDirectory()&&depth<3&&!entry.name.startsWith('.')&&entry.name!=='Utilities')await walk(file,depth+1);
  }
 }
 await walk('/Applications');await walk(path.join(os.homedir(),'Applications'));
 const apps=[],seen=new Set();let index=0;
 async function worker(){while(index<bundles.length){const bundle=bundles[index++];try{
  const {stdout}=await execFile('/usr/bin/plutil',['-convert','json','-o','-',path.join(bundle,'Contents','Info.plist')],{timeout:5000,maxBuffer:1024*1024});
  const info=JSON.parse(stdout),id=info.CFBundleIdentifier,name=info.CFBundleDisplayName||info.CFBundleName||path.basename(bundle,'.app');
  if(typeof id!=='string'||!/^[-A-Za-z0-9._]{2,220}$/.test(id)||typeof name!=='string'||seen.has(id))continue;
  if(info.LSBackgroundOnly||info.LSUIElement||info.CFBundlePackageType&&info.CFBundlePackageType!=='APPL')continue;
  seen.add(id);apps.push({name:name.slice(0,100),package:id,icon:await appIcon(bundle,info),aliases:[]});
 }catch{warnings.push('An application could not be inspected.');}}}
 await Promise.all(Array.from({length:4},worker));
 if(apps.length>500)warnings.push('Select from the first 500 detected apps.');
 return {apps:apps.sort((a,b)=>a.name.localeCompare(b.name)).slice(0,500),complete:!warnings.length,warnings:[...new Set(warnings)],counts:{applications:apps.length}};
}
module.exports={discoverMacApps};
