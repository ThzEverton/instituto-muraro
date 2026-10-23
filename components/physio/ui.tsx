'use client'
import { useState, type ReactNode } from 'react'
import { AlertCircle, ArrowDownToLine, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Search, X } from 'lucide-react'
import { maskCpf, maskPhone } from '@/lib/physio-model'

export type FieldType = 'text'|'tel'|'email'|'number'|'date'|'time'|'textarea'|'select'|'checkbox'|'multiselect'|'password'
export type FieldDef = { key:string; label:string; type?:FieldType; required?:boolean; placeholder?:string; options?:{label:string;value:string}[]; wide?:boolean; help?:string; min?:number; max?:number }
export type Column<T> = { label:string; cell:(item:T)=>ReactNode; width?:string }
export function formatOptions(items:{id:string;name:string}[], includeAll=false){return [...(includeAll?[{label:'Todos',value:''}]:[]),...items.map(x=>({label:x.name,value:x.id}))]}

export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'blue'|'green'|'amber'|'red'|'neutral'|'teal'}) {
 return <span className={'m-badge m-badge-'+tone}><span className="m-badge-dot"/>{children}</span>
}
export function stateTone(status:string):'blue'|'green'|'amber'|'red'|'neutral'|'teal'{
 if(['Ativo','Confirmado','Concluído','Paga','Publicado','Finalizada'].includes(status))return 'green'
 if(['Vencida','Cancelado','Não compareceu','Cancelada','Inativo'].includes(status))return 'red'
 if(['Pendente','Agendado','Rascunho','Parcial','Pausado'].includes(status))return 'amber'
 if(['Em atendimento'].includes(status))return 'teal'
 return 'blue'
}
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}){
 return <div className="m-empty"><span className="m-empty-icon"><ClipboardList size={25}/></span><strong>{title}</strong><p>{description}</p>{action}</div>
}
export function Dialog({title,subtitle,onClose,children,footer,wide=false}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;wide?:boolean}){
 return <div className="m-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className={'m-dialog'+(wide?' wide':'')} role="dialog" aria-modal="true" aria-label={title}>
   <header className="m-dialog-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="m-icon-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>
   <div className="m-dialog-body">{children}</div>
   {footer&&<footer className="m-dialog-footer">{footer}</footer>}
  </section>
 </div>
}
export function Inputs({fields,form,onChange}:{fields:FieldDef[];form:Record<string,any>;onChange:(key:string,value:any)=>void}){
 return <div className="m-form-grid">{fields.map(field=>{
  const value=form[field.key]??(field.type==='checkbox'?false:'')
  return <label className={'m-field'+(field.wide?' span-2':'')} key={field.key}>
   <span className="m-field-label">{field.label}{field.required&&<em> *</em>}</span>
   {field.type==='textarea' ? <textarea rows={3} value={String(value)} placeholder={field.placeholder} onChange={e=>onChange(field.key,e.target.value)} />
    :field.type==='select'?<select value={String(value)} onChange={e=>onChange(field.key,e.target.value)}><option value="">Selecione...</option>{(field.options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
    :field.type==='checkbox'?<span className="m-checkline"><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(field.key,e.target.checked)}/>{field.help||'Sim'}</span>
    :field.type==='multiselect'?<div className="m-multiselect">{(field.options||[]).map(o=><label key={o.value}><input type="checkbox" checked={(Array.isArray(value)?value:[]).includes(o.value)} onChange={e=>{const old=Array.isArray(value)?value:[];onChange(field.key,e.target.checked?[...old,o.value]:old.filter((v:string)=>v!==o.value))}}/>{o.label}</label>)}</div>
    :<input type={field.type||'text'} value={String(value)} placeholder={field.placeholder} min={field.min} max={field.max} onChange={e=>onChange(field.key,field.key==='cpf'?maskCpf(e.target.value):field.key.toLowerCase().includes('phone')?maskPhone(e.target.value):e.target.value)} />}
   {field.help&&field.type!=='checkbox'&&<small>{field.help}</small>}
  </label>
 })}</div>
}
export function Table<T extends {id:string}>({rows,columns,onRowClick,actions,emptyMessage='Nenhum registro encontrado',pageSize=8}:{rows:T[];columns:Column<T>[];onRowClick?:(x:T)=>void;actions?:(x:T)=>ReactNode;emptyMessage?:string;pageSize?:number}){
 const [page,setPage]=useState(1)
 const count=Math.max(1,Math.ceil(rows.length/pageSize))
 const active=Math.min(page,count)
 const subset=rows.slice((active-1)*pageSize,active*pageSize)
 return <>{rows.length===0?<Empty title={emptyMessage} description="Ajuste a pesquisa ou cadastre um novo registro."/>:
 <><div className="m-table-scroll"><table className="m-table"><thead><tr>{columns.map((c,i)=><th key={i} style={{width:c.width}}>{c.label}</th>)}{actions&&<th className="m-th-actions">Ações</th>}</tr></thead>
 <tbody>{subset.map(item=><tr key={item.id} className={onRowClick?'is-clickable':''} onClick={()=>onRowClick?.(item)}>
 {columns.map((c,i)=><td key={i}>{c.cell(item)}</td>)}{actions&&<td className="m-actions" onClick={e=>e.stopPropagation()}>{actions(item)}</td>}</tr>)}</tbody></table></div>
 <footer className="m-table-footer"><span>Exibindo {(active-1)*pageSize+1}–{Math.min(active*pageSize,rows.length)} de {rows.length} registros</span><div className="m-page-nav"><button title="Página anterior" disabled={active===1} onClick={()=>setPage(Math.max(1,active-1))}><ChevronLeft size={16}/></button><strong>{active} / {count}</strong><button title="Próxima página" disabled={active===count} onClick={()=>setPage(Math.min(count,active+1))}><ChevronRight size={16}/></button></div></footer></>}</>
}
export function SectionHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){
 return <header className="m-section-head"><div>{eyebrow&&<span className="m-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="m-section-actions">{actions}</div>}</header>
}
export function SearchFilter({search,setSearch,filter,setFilter,options,placeholder='Pesquisar por nome ou termo...'}:{search:string;setSearch:(s:string)=>void;filter?:string;setFilter?:(s:string)=>void;options?:{label:string;value:string}[];placeholder?:string}){
 return <div className="m-filterbar"><div className="m-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={placeholder} aria-label="Pesquisar"/></div>{setFilter&&<select value={filter||''} onChange={e=>setFilter(e.target.value)} aria-label="Filtrar">{(options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}</div>
}
export function Metric({label,value,caption,icon,accent='blue'}:{label:string;value:string|number;caption:string;icon:ReactNode;accent?:'blue'|'teal'|'amber'|'navy'}){
 return <article className="m-metric"><div className="m-metric-label"><span>{label}</span><span className={'m-metric-icon '+accent}>{icon}</span></div><strong>{value}</strong><p>{caption}</p></article>
}
export function Progress({done,total}:{done:number;total:number}){const pct=total>0?Math.round(Math.min(100,Math.max(0,done/total*100))):0;return <div className="m-progress"><div style={{width:pct+'%'}}/></div>}
export function ErrorNote({message}:{message:string}){return <div className="m-form-error"><AlertCircle size={16}/>{message}</div>}
export function Hint({children}:{children:ReactNode}){return <p className="m-hint"><CircleHelp size={15}/>{children}</p>}
export function PillButton({children,onClick,title,variant='plain',disabled}:{children:ReactNode;onClick:()=>void;title?:string;variant?:'plain'|'danger'|'success';disabled?:boolean}){return <button type="button" className={'m-pill-action '+variant} disabled={disabled} title={title} onClick={onClick}>{children}</button>}
export function ExportButton({onClick}:{onClick:()=>void}){return <button className="m-btn secondary" onClick={onClick}><ArrowDownToLine size={16}/> Exportar CSV</button>}
export function SaveButton({onClick,disabled=false}:{onClick:()=>void;disabled?:boolean}){return <button className="m-btn primary" onClick={onClick} disabled={disabled}><Check size={17}/> Salvar alterações</button>}
