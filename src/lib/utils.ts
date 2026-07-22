import { clsx, type ClassValue } from 'clsx'; import { twMerge } from 'tailwind-merge'
export const cn=(...v:ClassValue[])=>twMerge(clsx(v))
export const money=(n:number,c='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c,maximumFractionDigits:2}).format(n)
export const shortDate=(d:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(d))
export const downloadCsv=<T extends object>(name:string,rows:T[])=>{if(!rows.length)return;const keys=Object.keys(rows[0]) as (keyof T)[];const csv=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
