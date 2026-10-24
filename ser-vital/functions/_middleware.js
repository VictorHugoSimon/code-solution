export async function onRequest({request,next}){
  const response=await next();
  const url=new URL(request.url);
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html')||url.pathname.startsWith('/admin'))return response;
  return new HTMLRewriter().on('body',{element(el){el.append('<script src="/app.js" defer></script>',{html:true})}}).transform(response);
}
