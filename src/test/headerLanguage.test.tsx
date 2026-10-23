import {useState} from 'react'
import {act,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {LanguagePicker} from '../components/navigation/LanguagePicker'
import {AppearancePreferences,LanguagePreferences} from '../components/settings/AppearancePreferences'
import {NotificationBell} from '../components/notifications/NotificationBell'
import {ProfileMenu} from '../components/profile/ProfileMenu'
import {ReferenceDashboardView} from '../components/dashboard/ReferenceDashboardView'
import {LocaleDocument,T,translate} from '../i18n'
import {messages} from '../i18n/messages'
import {normalizeAppLocale,useAppLocale} from '../i18n/localeStore'
import {useDemoStore} from '../store/useDemoStore'
vi.mock('../hooks/usePlatformNotifications',()=>({usePlatformNotifications:()=>({notifications:[{id:'qa-unread',read:false}]})}))
vi.mock('../components/notifications/NotificationPanel',()=>({NotificationPanel:()=> <div role="dialog" aria-label="Notificações de teste"/>}))
vi.mock('../components/profile/ProfileAvatar',()=>({ProfileAvatar:()=> <span>QA</span>}))
vi.mock('../hooks/useCompetition',()=>({useCompetition:()=>({standings:[],loading:false,error:''})}))
const mount=(children:React.ReactNode)=>render(<MemoryRouter>{children}</MemoryRouter>)
beforeEach(()=>act(()=>{localStorage.clear();useAppLocale.getState().setLocale('pt-BR');useDemoStore.getState().reset()}))

describe('idioma e preferências do cabeçalho',()=>{
 it('seleciona por teclado, restaura foco, persiste e atualiza lang',async()=>{
  mount(<><LocaleDocument/><LanguagePicker/></>);const user=userEvent.setup(),trigger=screen.getByRole('button',{name:'Idioma do aplicativo: Português (Brasil)'})
  await user.click(trigger);expect(screen.getByRole('menuitemradio',{name:'Português (Brasil)'})).toHaveFocus()
  await user.keyboard('{End}{Enter}');expect(useAppLocale.getState().locale).toBe('es-ES');expect(document.documentElement.lang).toBe('es-ES');expect(trigger).toHaveFocus();expect(trigger).toHaveTextContent('ES')
  expect(JSON.parse(localStorage.getItem('sphexpay-language-v1')!).state).toEqual({locale:'es-ES'})
  await user.keyboard('{ArrowDown}{Home}{ArrowDown}{Enter}');expect(trigger).toHaveTextContent('EN');expect(document.documentElement.lang).toBe('en-US')
  await user.click(trigger);expect(within(screen.getByRole('menu')).getAllByRole('menuitemradio')).toHaveLength(3);await user.keyboard('{Escape}');expect(screen.queryByRole('menu')).not.toBeInTheDocument();expect(trigger).toHaveFocus()
 })
 it('fecha menus anteriores ao abrir idioma, notificações ou perfil',async()=>{
  mount(<><LanguagePicker/><NotificationBell/><ProfileMenu name="QA" onSignOut={async()=>undefined}/></>);const user=userEvent.setup()
  await user.click(screen.getByRole('button',{name:'Abrir menu do perfil'}));expect(screen.getByRole('menu',{name:'Menu do perfil'})).toBeVisible()
  await user.click(screen.getByRole('button',{name:/Idioma do aplicativo:/}));expect(screen.queryByRole('menu',{name:'Menu do perfil'})).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/Notificações,/}));expect(screen.queryByRole('menu')).not.toBeInTheDocument();expect(screen.getByRole('dialog')).toBeVisible()
  await user.click(screen.getByRole('button',{name:/Idioma do aplicativo:/}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('menu')).toBeVisible()
 })
 it('oferece claro, escuro e sistema como preferências persistentes',async()=>{
  mount(<AppearancePreferences/>);const user=userEvent.setup()
  await user.click(screen.getByRole('radio',{name:'Modo claro'}));expect(useDemoStore.getState().themePreference).toBe('light');expect(document.documentElement.dataset.theme).toBe('light')
  await user.click(screen.getByRole('radio',{name:'Modo escuro'}));expect(useDemoStore.getState().themePreference).toBe('dark');expect(document.documentElement.dataset.theme).toBe('dark')
  await user.click(screen.getByRole('radio',{name:'Seguir preferência do sistema'}));expect(useDemoStore.getState().themePreference).toBe('system');expect(screen.getByRole('radio',{name:'Seguir preferência do sistema'})).toBeChecked()
 })
 it('compartilha a escolha entre cabeçalho e preferências sem reiniciar o formulário',async()=>{
  function Form(){const [value,setValue]=useState('');return <><LanguagePicker/><LanguagePreferences/><label><T>Nome</T><input value={value} onChange={event=>setValue(event.target.value)}/></label></>}
  mount(<Form/>);const user=userEvent.setup();await user.type(screen.getByRole('textbox'),'Produto QA');const initialFinancialState=useDemoStore.getState()
  await user.click(screen.getByRole('radio',{name:'English (US)'}));expect(screen.getByRole('textbox',{name:'Name'})).toHaveValue('Produto QA');expect(screen.getByRole('button',{name:'App language: English (US)'})).toHaveTextContent('EN');expect(useDemoStore.getState()).toBe(initialFinancialState)
 })
 it('rejeita localidades persistidas inválidas e preserva variáveis de tradução',async()=>{
  expect(normalizeAppLocale('fr-FR')).toBe('pt-BR');expect(normalizeAppLocale(null)).toBe('pt-BR')
  localStorage.setItem('sphexpay-language-v1',JSON.stringify({state:{locale:'fr-FR'},version:1}));await useAppLocale.persist.rehydrate();expect(useAppLocale.getState().locale).toBe('pt-BR')
  for(const [source,translations] of Object.entries(messages)){const variables=(text:string)=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();for(const target of Object.values(translations)){expect(target.trim(),source).not.toBe('');expect(variables(target),source).toEqual(variables(source))}}
  expect(translate('{count} não lidas','en-US',{count:9})).toContain('9')
 })
 it('traduz o dashboard preservando nomes de pessoas, produtos e valores',()=>{
  mount(<ReferenceDashboardView name="Produtos" period={{preset:'7d'}} setPeriod={()=>undefined} currency="BRL" setCurrency={()=>undefined} metrics={{approvedRevenueCents:0,approvedSales:0,averageTicketCents:0,feesCents:0,approvalRate:0,chargebacks:0}} series={[]} sales={[{transactionId:'qa',buyerName:'QA Teste',productName:'Produtos',paymentMethod:'Pix',status:'approved',amountCents:12345,feeCents:0,currency:'BRL',occurredAt:'2026-10-20T00:00:00Z'}]} rates={[]} eligibleRevenueCents={0} loading={false} error=""/> )
  expect(screen.getByRole('heading',{name:'Olá, Produtos'})).toBeVisible();const value=screen.getByText(/123,45/).textContent
  act(()=>useAppLocale.getState().setLocale('en-US'));expect(screen.getByRole('heading',{name:'Hello, Produtos'})).toBeVisible();expect(screen.getByRole('heading',{name:'Revenue'})).toBeVisible();expect(screen.getByText('Produtos',{exact:true})).toBeVisible();expect(screen.getByText(/123,45/).textContent).toBe(value)
  act(()=>useAppLocale.getState().setLocale('es-ES'));expect(screen.getByRole('heading',{name:'Hola, Produtos'})).toBeVisible();expect(screen.getByText(/123,45/).textContent).toBe(value)
 })
})
