import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Ajustes da barra de navegação do celular, salvos neste aparelho.
// transparency: quanto do fundo aparece por trás da barra (0 = opaca, 100 = vidro bem transparente).
type TabBarPreferences={transparency:number;hideOnScroll:boolean;haptics:boolean}
type Actions={setTransparency:(value:number)=>void;setHideOnScroll:(value:boolean)=>void;setHaptics:(value:boolean)=>void}
export const clampTransparency=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?Math.min(100,Math.max(0,Math.round(number))):70}

export const useTabBarPreferences=create<TabBarPreferences&Actions>()(persist(set=>({
 transparency:70,hideOnScroll:true,haptics:true,
 setTransparency:value=>set({transparency:clampTransparency(value)}),
 setHideOnScroll:hideOnScroll=>set({hideOnScroll}),
 setHaptics:haptics=>set({haptics}),
}),{name:'sphexpay-tab-bar-v1',version:1}))
