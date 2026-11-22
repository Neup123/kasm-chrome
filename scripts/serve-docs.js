#!/usr/bin/env node
'use strict';
// Development-only, local API reference. No driver key, proxy, or public bind.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const routes=new Map([
  ['/', ['docs/api.html','text/html; charset=utf-8']],
  ['/openapi.json',['docs/openapi.json','application/json']],
  ['/reference.js',['docs/reference.js','application/javascript']],
  ['/scalar.js',['node_modules/@scalar/api-reference/dist/browser/standalone.js','application/javascript']]
]);
const server=http.createServer((req,res)=>{
  const route=routes.get(req.url);
  if(req.method!=='GET'||!route){res.writeHead(404);res.end();return;}
  try{
    const bytes=fs.readFileSync(path.join(root,route[0]));
    res.writeHead(200,{'Content-Type':route[1],'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"});
    res.end(bytes);
  }catch{res.writeHead(503);res.end('Install development dependencies before serving the reference.');}
});
server.listen(8089,'127.0.0.1',()=>console.log('Local API reference: http://127.0.0.1:8089 (no production credentials or proxy)'));
process.on('SIGTERM',()=>server.close());
process.on('SIGINT',()=>server.close());
