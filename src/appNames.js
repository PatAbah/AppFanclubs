
const arch='(?:32[ -]?bit|64[ -]?bit|x86_64|x86|x64|amd64|arm64|aarch64)';
const locale='[a-z]{2,3}[-_][a-z]{2}';
const version='(?:version\\s+|v)?\\d+(?:\\.\\d+){1,4}(?:[-+][0-9a-z.-]+)?';
const install='(?:user|per[ -]user|all[ -]users|machine|user\\s+(?:setup|installer)|system\\s+(?:setup|installer))';
const noise=new RegExp('^(?:(?:'+[arch,locale,version,install].join('|')+')[\\s,;/_-]*)+$','i');
export function cleanAppName(value){
 const original=value.trim();let name=original.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g,(match,a,b)=>noise.test((a||b||'').trim())?'':match);
 for(let i=0;i<3;i++){
  name=name.replace(new RegExp('\\s+(?:[-–—]\\s*)?(?:'+arch+'|'+locale+')\\s*$','i'),'').trim();
  if(!/^(?:python|\.net|node\.?js|java|jdk|openjdk|php|ruby)\b/i.test(name))name=name.replace(new RegExp('\\s+(?:[-–—]\\s*)?'+version+'\\s*$','i'),'').trim();
 }
 return name.replace(/\s+/g,' ').replace(/^[ –—-]+|[ –—-]+$/g,'')||original;
}
