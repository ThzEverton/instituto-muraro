'use client'
import {createContext,useContext} from 'react'
export type SessaoInterface={id:string;perfil:'ADMINISTRADOR'|'RECEPCAO'|'FISIOTERAPEUTA';nome?:string}
export const ContextoSessao=createContext<SessaoInterface|null>(null)
export function usePerfilSessao(){const sessao=useContext(ContextoSessao);if(!sessao)throw new Error('Sessão indisponível');return sessao.perfil}
