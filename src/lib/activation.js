const apiUrl=import.meta.env.VITE_API_URL||"http://localhost:8787";
const sessionKey="intentos-activation-session";
const activationSession=()=>{let id=sessionStorage.getItem(sessionKey);if(!id){id=crypto.randomUUID();sessionStorage.setItem(sessionKey,id);}return id;};
export function trackActivation(token,eventName,{assetId=null,properties={}}={}){if(!token)return Promise.resolve(false);return fetch(`${apiUrl}/api/activation/events`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({eventName,sessionId:activationSession(),assetId,idempotencyKey:crypto.randomUUID(),properties})}).then(response=>response.ok).catch(()=>false);}
export async function loadActivationReport(token){try{const response=await fetch(`${apiUrl}/api/activation/report`,{headers:{authorization:`Bearer ${token}`}});if(!response.ok)return null;return(await response.json()).report;}catch{return null;}}
