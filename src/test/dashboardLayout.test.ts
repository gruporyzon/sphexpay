import { beforeEach,describe,expect,it } from 'vitest'
import { DASHBOARD_LAYOUT_STORAGE_KEY,createDefaultDashboardLayouts,dashboardPreset,loadDashboardLayouts,moveDashboardWidget,saveDashboardLayouts,validateDashboardLayout } from '../lib/dashboardLayout'

describe('layout responsivo do Dashboard',()=>{
 beforeEach(()=>localStorage.clear())
 it('mantém configurações válidas e independentes para os três tamanhos',()=>{
  const layouts=createDefaultDashboardLayouts()
  expect(validateDashboardLayout(layouts.desktop,'desktop').valid).toBe(true)
  expect(validateDashboardLayout(layouts.tablet,'tablet').valid).toBe(true)
  expect(validateDashboardLayout(layouts.mobile,'mobile').valid).toBe(true)
  const moved=moveDashboardWidget(layouts.mobile,'revenue-chart',0)
  expect(moved[0].widgetId).toBe('revenue-chart')
  expect(layouts.desktop[0].widgetId).toBe('gross-revenue')
 })
 it('impede widgets ausentes, duplicados, fora da tela e gráfico estreito',()=>{
  const layout=createDefaultDashboardLayouts().desktop
  expect(validateDashboardLayout(layout.slice(1),'desktop').errors['gross-revenue']).toBeTruthy()
  expect(validateDashboardLayout([...layout,layout[0]],'desktop').errors['gross-revenue']).toBeTruthy()
  expect(validateDashboardLayout(layout.map(item=>item.widgetId==='revenue-chart'?{...item,columnSpan:5}:item),'desktop').errors['revenue-chart']).toContain('gráfico')
  expect(validateDashboardLayout(layout.map(item=>item.widgetId==='fees'?{...item,columnStart:12,columnSpan:2}:item),'desktop').errors.fees).toContain('ultrapassa')
 })
 it.each(['default','metrics-first','chart-focus','sales-focus','compact','executive'] as const)('gera o preset %s sem posições inválidas',preset=>{
  const layouts=dashboardPreset(preset)
  expect(validateDashboardLayout(layouts.desktop,'desktop').valid).toBe(true)
  expect(validateDashboardLayout(layouts.tablet,'tablet').valid).toBe(true)
  expect(validateDashboardLayout(layouts.mobile,'mobile').valid).toBe(true)
 })
 it('persiste apenas a configuração versionada do usuário e recupera fallback em corrupção',()=>{
  const layouts=dashboardPreset('chart-focus')
  saveDashboardLayouts('user-1',layouts,'chart-focus')
  expect(loadDashboardLayouts('user-1')?.layouts.desktop[0].widgetId).toBe('revenue-chart')
  expect(loadDashboardLayouts('user-2')).toBeNull()
  localStorage.setItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}:user-1`,'{corrompido')
  expect(loadDashboardLayouts('user-1')).toBeNull()
 })
})
