import type { NextRequest } from 'next/server'

// O Next pode normalizar nextUrl para localhost mesmo com Host 127.0.0.1.
// Em produção, defina a origem HTTPS pública caso exista proxy reverso.
export function origemPermitida(req:NextRequest){
  if(req.headers.get('sec-fetch-site')==='cross-site')return false
  const origem=req.headers.get('origin')
  if(!origem)return true
  let url:URL
  try{url=new URL(origem)}catch{return false}
  if(url.origin!==origem)return false
  const configurada=process.env.ORIGEM_APLICACAO
  if(configurada)return origem===configurada
  const host=req.headers.get('host')
  if(!host||url.host!==host)return false
  if(process.env.NODE_ENV==='production')return url.protocol==='https:'
  return url.protocol===req.nextUrl.protocol
}
