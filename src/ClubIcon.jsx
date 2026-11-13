import React from 'react';
export function blendName(apps){const names=[...apps].sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})).map(a=>a.name);return names.length<3?names.join(' and '):names.slice(0,-1).join(', ')+', and '+names.at(-1)}
export default function Icon({club,size=42}){
 if(club?.kind==='blend'&&club.apps?.length){const apps=club.apps;return <span className="app-icon blend-stack" style={{width:size*(1+.48*(apps.length-1)),height:size,"--stack-width":size*(1+.48*(apps.length-1))+"px"}} role="img" aria-label={club.name} title={club.name}>{apps.map((a,i)=>{const style={width:size,height:size,left:i*size*.48,top:0,zIndex:i+1};return a.icon?<img key={a.id||i} className="blend-part" style={style} src={a.icon} alt=""/>:<span key={a.id||i} className="blend-part fallback" style={{...style,fontSize:size*.3}}>{a.name?.[0]?.toUpperCase()}</span>})}</span>}
 return club?.icon?<img className="app-icon" style={{width:size,height:size}} src={club.icon} alt=""/>:<span className="app-icon fallback" style={{width:size,height:size}}>{club?.name?.slice(0,1).toUpperCase()||'?'}</span>
}
