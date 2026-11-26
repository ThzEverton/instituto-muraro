import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const acao = req.nextUrl.searchParams.get('acao')
  if (acao !== 'consultar' && acao !== 'enviar') return NextResponse.json({ erro: 'Rota indisponível' }, { status: 404 })
  const origem = req.headers.get('origin')
  if (origem && origem !== req.nextUrl.origin) return NextResponse.json({ erro: 'Origem inválida' }, { status: 403 })
  try {
    const corpo = await req.text()
    if (Buffer.byteLength(corpo) > 700000) return NextResponse.json({ erro: 'Resposta muito extensa' }, { status: 413 })
    const r = await fetch((process.env.API_INTERNA_URL ?? 'http://127.0.0.1:3333') + '/api/v1/formulario-publico/' + acao, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, cache: 'no-store',
    })
    return NextResponse.json(await r.json(), { status: r.status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch {
    return NextResponse.json({ erro: 'Serviço temporariamente indisponível' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
