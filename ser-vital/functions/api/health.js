export async function onRequestGet({env}){
  let database='not-configured';
  if(env.DB){try{await env.DB.prepare('SELECT 1').first();database='ok'}catch{database='error'}}
  return new Response(JSON.stringify({ok:database==='ok',service:'ser-vital',database,timestamp:new Date().toISOString()}),{status:database==='error'?503:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
