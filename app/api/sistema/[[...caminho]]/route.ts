import { NextRequest, NextResponse } from 'next/server'

function rotaPermitida(caminho: string, metodo: string): boolean {
  if (caminho === 'autenticacao/entrar') return metodo === 'POST'
  if (caminho === 'autenticacao/sair') return metodo === 'POST'
  if (caminho === 'saude') return metodo === 'GET'
  if (caminho === 'pacientes') return metodo === 'GET' || metodo === 'POST'
  return /^pacientes\/[^/]+$/.test(caminho) && (metodo === 'GET' || metodo === 'PATCH')
}

async function encaminhar(requisicao: NextRequest, contexto: { params: Promise<{ caminho?: string[] }> }) {
  const { caminho: partes = [] } = await contexto.params
  const caminho = partes.join('/')
  if (!rotaPermitida(caminho, requisicao.method)) {
    return NextResponse.json({ erro: 'Rota indisponível' }, { status: 404 })
  }
  if (requisicao.method !== 'GET') {
    const origem = requisicao.headers.get('origin')
    if (origem && new URL(origem).host !== requisicao.nextUrl.host) {
      return NextResponse.json({ erro: 'Origem inválida' }, { status: 403 })
    }
  }
  const endereco = process.env.API_INTERNA_URL ?? 'http://127.0.0.1:3333'
  const token = requisicao.cookies.get('muraro_sessao')?.value
  if (!token && caminho !== 'autenticacao/entrar' && caminho !== 'saude') {
    return NextResponse.json({ erro: 'Autenticação obrigatória' }, { status: 401 })
  }
  try {
    const respostaApi = await fetch(
      `${endereco}/api/v1/${partes.map(encodeURIComponent).join('/')}${requisicao.nextUrl.search}`,
      {
        method: requisicao.method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(requisicao.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        },
        body: requisicao.method !== 'GET' ? await requisicao.text() : undefined,
        cache: 'no-store',
      },
    )
    const corpo = await respostaApi.json()
    if (caminho === 'autenticacao/entrar' && respostaApi.ok) {
      const resposta = NextResponse.json({ dados: { usuario: corpo.dados.usuario } })
      resposta.cookies.set('muraro_sessao', corpo.dados.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/sistema',
        expires: new Date(corpo.dados.expiraEm),
      })
      resposta.headers.set('Cache-Control', 'no-store')
      return resposta
    }
    const resposta = NextResponse.json(corpo, { status: respostaApi.status })
    if (caminho === 'autenticacao/sair') resposta.cookies.delete('muraro_sessao')
    resposta.headers.set('Cache-Control', 'no-store')
    return resposta
  } catch {
    return NextResponse.json({ erro: 'API indisponível' }, { status: 503 })
  }
}

export { encaminhar as GET, encaminhar as POST, encaminhar as PATCH }
