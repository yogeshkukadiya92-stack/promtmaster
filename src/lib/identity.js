const request=async(path,accessToken,options={})=>{if(!accessToken)return null;const response=await fetch(path,{...options,headers:{authorization:`Bearer ${accessToken}`,accept:"application/json",...(options.body?{"content-type":"application/json"}:{})}});if(!response.ok)return null;return response.json();};
export const loadIdentity=async(token)=>(await request("/api/identity",token))?.identity||null;
export const saveIdentity=async(token,input)=>(await request("/api/identity",token,{method:"PATCH",body:JSON.stringify(input)}))?.identity||null;
export const rotateScimToken=(token)=>request("/api/identity/scim-token",token,{method:"POST"});
