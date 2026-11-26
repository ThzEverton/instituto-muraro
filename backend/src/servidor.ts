import { criarAplicacao } from './app.js'
export { criarAplicacao } from './app.js'

if (process.env.NODE_ENV !== 'test') {
  const aplicacao = await criarAplicacao()
  await aplicacao.listen({ port: Number(process.env.PORT ?? 3333), host: process.env.HOST ?? '127.0.0.1' })
}
