const call=async(path,token,options={})=>{if(!token)return null;const response=await fetch(path,{...options,headers:{authorization:`Bearer ${token}`,accept:"application/json",...(options.body?{"content-type":"application/json"}:{})}});if(!response.ok)return null;return response.json();};
export const loadReleases=async(token)=>(await call("/api/releases",token))?.releases||[];
export const requestPromotion=async(token,assetId)=>(await call("/api/releases",token,{method:"POST",body:JSON.stringify({assetId})}))?.releases||null;
export const decidePromotion=async(token,id,decision)=>(await call(`/api/releases/${encodeURIComponent(id)}/decision`,token,{method:"POST",body:JSON.stringify({decision})}))?.releases||null;
export const rollbackRelease=async(token,id)=>(await call(`/api/releases/${encodeURIComponent(id)}/rollback`,token,{method:"POST"}))?.releases||null;
