export const appUrl=path=>import.meta.env.BASE_URL+path.replace(/^\/+/,'');
export async function api(path, data, method='POST') {
  const form=data instanceof FormData;
  const response=await fetch(appUrl('api'+path),{method:data===undefined?'GET':method,credentials:'same-origin',headers:{'X-Requested-With':'AppFanclubs',...(!form&&data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:form?data:JSON.stringify(data)});
  const result=await response.json().catch(()=>({error:'Server unavailable'}));
  if(!response.ok) throw new Error(result.error||'Request failed');
  return result;
}
export function nativeSend(type,data={}){if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type,...data})); else if(window.fanclubs) window.fanclubs.send(type,data);}
