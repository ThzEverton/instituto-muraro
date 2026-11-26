import { NextRequest, NextResponse } from 'next/server'

function rotaPermitida(caminho: string, metodo: string): boolean {
  if (caminho === 'autenticacao/entrar') return metodo === 'POST'
  if (caminho === 'formularios/modelos' || caminho === 'formularios/links') return metodo === 'GET' || metodo === 'POST'
  if (/^formularios\/(modelos|links)\/[^/]+$/.test(caminho)) return metodo === 'PATCH'
  if (/^formularios\/modelos\/[^/]+\/(publicar|versao)$/.test(caminho)) return metodo === 'POST'
  if (caminho === 'autenticacao/sessao') return metodo === 'GET'
  if (caminho === 'clinica/contas' || caminho === 'clinica/vinculos') return metodo === 'GET' || metodo === 'POST'
  if (caminho === 'clinica/associacoes') return metodo === 'POST'
  if (caminho === 'clinica/pacientes') return metodo === 'GET'
  if (/^clinica\/pacientes\/[^/]+\/prontuario$/.test(caminho)) return metodo === 'GET' || metodo === 'POST'
  if (/^clinica\/pacientes\/[^/]+\/prontuario\/[^/]+$/.test(caminho)) return metodo === 'PATCH'
  if (caminho === 'autenticacao/sair') return metodo === 'POST'
  if (caminho === 'saude') return metodo === 'GET'
  if (caminho === 'pacientes') return metodo === 'GET' || metodo === 'POST'
  if (caminho === 'profissionais' || caminho === 'servicos') return metodo === 'GET' || metodo === 'POST'
  if (caminho === 'agenda/ausencias') return metodo === 'GET' || metodo === 'POST'
  if (/^agenda\/ausencias\/[^/]+$/.test(caminho)) return metodo === 'PATCH'
  if (caminho === 'agendamentos/serie') return metodo === 'POST'
  if (caminho === 'salas') return metodo === 'GET' || metodo === 'POST'
  if (caminho === 'agendamentos') return metodo === 'GET' || metodo === 'POST'
  if (caminho === 'agenda/disponibilidade' || caminho === 'agenda/bloqueios') return metodo === 'GET' || (caminho === 'agenda/bloqueios' && metodo === 'POST')
  if (/^agenda\/bloqueios\/[^/]+$/.test(caminho)) return metodo === 'PATCH'
  if (/^agendamentos\/[^/]+$/.test(caminho)) return metodo === 'PATCH'
  if (/^(profissionais|servicos)\/[^/]+$/.test(caminho)) return metodo === 'GET' || metodo === 'PATCH'
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
    if (caminho === 'autenticacao/sair') resposta.cookies.set('muraro_sessao', '', { path: '/api/sistema', maxAge: 0, httpOnly: true })
    resposta.headers.set('Cache-Control', 'no-store')
    return resposta
  } catch {
    return NextResponse.json({ erro: 'API indisponível' }, { status: 503 })
  }
}

export { encaminhar as GET, encaminhar as POST, encaminhar as PATCH }
