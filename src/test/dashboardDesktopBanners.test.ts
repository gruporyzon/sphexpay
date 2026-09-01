import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe,expect,it} from 'vitest'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
const marker='/* Desktop dashboard spotlights — premium final cascade; mobile and tablet remain unchanged. */'
const premium=css.slice(css.indexOf(marker))

describe('banners premium da dashboard no desktop',()=>{
 it('isola o refinamento visual em telas desktop',()=>{expect(css.indexOf(marker)).toBeGreaterThan(0);expect(premium).toContain('@media(min-width:1024px)');expect(premium).toContain('.dashboard-page>.spx-operation-hero');expect(premium).toContain('.dashboard-page>.next-award-card')})
 it('refina hero, CTA e controles sem alterar componentes funcionais',()=>{expect(premium).toContain('height:clamp(246px,20vw,292px)');expect(premium).toContain('.overview-copy :is(button,.overview-cta)');expect(premium).toContain('.overview-controls>button');expect(premium).toContain('cubic-bezier(.2,.78,.2,1)')})
 it('adiciona profundidade e progresso premium à próxima premiação',()=>{expect(premium).toContain('dashboard-award-sheen');expect(premium).toContain('.next-award-progress i');expect(premium).toContain('.next-award-plaque');expect(premium).toContain(':root[data-theme=dark]')})
 it('respeita redução de movimento',()=>{expect(premium).toContain('@media(prefers-reduced-motion:reduce)');expect(premium).toContain('animation:none!important')})
})
