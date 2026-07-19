const call=async(path,token,options={})=>{if(!token)return null;const response=await fetch(path,{...options,headers:{authorization:`Bearer ${token}`,accept:"application/json",...(options.body?{"content-type":"application/json"}:{})}});if(!response.ok)return null;return response.json();};
export const loadInfrastructure=(token)=>call("/api/infrastructure-controls",token);
export const saveInfrastructure=(token,input)=>call("/api/infrastructure-controls",token,{method:"PATCH",body:JSON.stringify(input)});
export const revokeInfrastructureKey=(token)=>call("/api/infrastructure-controls/key",token,{method:"DELETE"});
export const runRecoveryDrill=(token,input)=>call("/api/recovery-drills",token,{method:"POST",body:JSON.stringify(input)});
