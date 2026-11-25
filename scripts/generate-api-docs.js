#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {COMMANDS,FIELDS,LIMITS,COLORS,ICONS,PROBES} = require('../extension/protocol');
const properties = {
  id:{type:'string',maxLength:LIMITS.maxIdLength,pattern:'^[A-Za-z0-9][A-Za-z0-9_.:-]*$',description:'Unique request ID; generated when omitted. Accepted IDs are retained for 15 minutes to reject replay.'},
  container:{type:'string',minLength:1,maxLength:LIMITS.maxContainerLength,description:'Exact, unambiguous Firefox contextual-identity name.'},
  tabId:{type:'integer',minimum:0},
  url:{type:'string',format:'uri',maxLength:8192,description:'Only https://chatgpt.com or http://driver:8080, without URL credentials.'},
  color:{type:'string',enum:COLORS}, icon:{type:'string',enum:ICONS},
  active:{type:'boolean',default:true},clear:{type:'boolean',default:true},
  selector:{type:'string',minLength:1,maxLength:LIMITS.maxSelectorLength,description:'Standard CSS selector; actions require exactly one match.'},
  text:{type:'string',maxLength:LIMITS.maxTextLength},
  maxLength:{type:'integer',minimum:1,maximum:LIMITS.maxReadTextLength,default:LIMITS.maxReadTextLength},
  probe:{type:'string',enum:PROBES,description:'Packaged diagnostics only. No arbitrary JavaScript evaluation.'},
  timeoutMs:{type:'integer',minimum:100,maximum:LIMITS.maxTimeoutMs,default:15000}
};
const schemas=COMMANDS.map(cmd=>{
  const keys=['id','timeoutMs',...(cmd==='containers.list'?[]:['container']),...FIELDS[cmd]];
  const required=['cmd',...(cmd==='containers.list'?[]:['container'])];
  for(const key of ['tabId','url','text','probe']) if(FIELDS[cmd].includes(key)) required.push(key);
  if(['tabs.click','tabs.type'].includes(cmd)) required.push('selector');
  const schema={type:'object',additionalProperties:false,properties:{cmd:{const:cmd},...Object.fromEntries(keys.map(k=>[k,properties[k]]))},required};
  if(cmd==='tabs.eval') schema.allOf=[{if:{properties:{probe:{const:'elements'}}},then:{required:['selector']}}];
  return schema;
});
const reply={description:'Command result or structured error. A timeout/disconnect after dispatch has an unknown browser outcome; inspect the page before issuing another mutation.',content:{'application/json':{schema:{oneOf:[
  {type:'object',required:['id','ok','result'],properties:{id:{type:'string'},ok:{const:true},result:{}}},
  {type:'object',required:['id','ok','error'],properties:{id:{type:['string','null']},ok:{const:false},error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}}}}
]}}}};
const spec={openapi:'3.1.0',info:{title:'Kasm Firefox Agent Driver',version:'0.1.0',description:'Server-to-server API for named Firefox containers. WebSocket, fixtures and health endpoints are private and are not part of this routed API. All commands require a separate API key. Browser Origin headers are refused.'},
  servers:[{url:'/agent-driver/v1'}],security:[{DriverKey:[]}],
  components:{securitySchemes:{DriverKey:{type:'apiKey',in:'header',name:'X-API-Key'}},schemas:{Command:{oneOf:schemas}}},
  paths:{'/status':{get:{summary:'Check extension readiness',responses:{200:{description:'Authenticated bridge state and extension version'},401:{description:'Invalid or missing API key'}}}},
  '/commands':{post:{summary:'Execute one browser command',requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/Command'},example:{id:'ensure-1',cmd:'containers.ensure',container:'ChatGPT 1',color:'blue',icon:'fingerprint'}}}},responses:Object.fromEntries([200,400,401,403,409,413,415,422,429,502,503,504].map(n=>[n,reply]))}},
  '/openapi.json':{get:{summary:'Read this API definition',responses:{200:{description:'OpenAPI 3.1 document'}}}}}};
const target=path.join(__dirname,'..','docs','openapi.json');
const content=JSON.stringify(spec,null,2)+'\n';
if(process.argv.includes('--check')) {
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content) {console.error('API definition is out of date. Run node scripts/generate-api-docs.js.');process.exit(1);}
  console.log('API definition matches the shared command contract.');
} else fs.writeFileSync(target,content);
