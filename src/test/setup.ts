import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
class ResizeObserverMock { observe(){} unobserve(){} disconnect(){} }
vi.stubGlobal('ResizeObserver', ResizeObserverMock)
class IntersectionObserverMock { constructor(private callback:IntersectionObserverCallback){} observe(element:Element){this.callback([{isIntersecting:true,target:element} as IntersectionObserverEntry],this as unknown as IntersectionObserver)} unobserve(){} disconnect(){} }
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
Object.defineProperty(window, 'matchMedia', { writable:true, value:vi.fn().mockImplementation(query=>({matches:false,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()})) })
Object.defineProperty(window, 'speechSynthesis', { writable:true, value:{cancel:vi.fn(),speak:vi.fn((utterance:{onstart?:()=>void})=>utterance.onstart?.()),pause:vi.fn(),resume:vi.fn(),getVoices:vi.fn(()=>[]),addEventListener:vi.fn(),removeEventListener:vi.fn()} })
vi.stubGlobal('SpeechSynthesisUtterance',class {lang='';rate=1;volume=1;voice=null;onstart?:()=>void;onend?:()=>void;onerror?:()=>void;constructor(public text:string){}})
Object.defineProperty(URL, 'createObjectURL', { writable:true, value:vi.fn(()=> 'blob:demo') })
Object.defineProperty(URL, 'revokeObjectURL', { writable:true, value:vi.fn() })
Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{writable:true,value:vi.fn(()=>null)})
