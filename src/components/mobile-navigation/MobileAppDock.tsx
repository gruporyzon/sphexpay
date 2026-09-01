import {useCallback,useEffect,useRef,useState} from 'react'
import {Grid2X2} from 'lucide-react'
import {useLocation,useNavigate} from 'react-router-dom'
import {mobileNavigationIndex,primaryMobileNavigation} from '../../config/navigation'
import {useDemoStore} from '../../store/useDemoStore'
import {MobileDockIndicator} from './MobileDockIndicator'
import {MobileMoreSheet} from './MobileMoreSheet'
import './mobile-navigation.css'

export function MobileAppDock(){
 const location=useLocation(),navigate=useNavigate(),[more,setMore]=useState(false),[scrolling,setScrolling]=useState(false),[mobile,setMobile]=useState(()=>matchMedia('(max-width: 767px)').matches),opacity=useDemoStore(state=>state.preferences.mobileNavigation.opacity),index=mobileNavigationIndex(location.pathname),scrollFrame=useRef(0),scrollEnd=useRef<number|undefined>(undefined),scrollingRef=useRef(false),close=useCallback(()=>setMore(false),[])
 useEffect(()=>{const media=matchMedia('(max-width: 767px)'),update=()=>setMobile(media.matches);media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[])
 useEffect(()=>setMore(false),[location.pathname])
 useEffect(()=>{
  if(!mobile)return
  const markScroll=()=>{
   if(!scrollingRef.current){scrollingRef.current=true;setScrolling(true)}
   if(scrollEnd.current)window.clearTimeout(scrollEnd.current)
   scrollEnd.current=window.setTimeout(()=>{scrollingRef.current=false;setScrolling(false)},180)
  }
  const onScroll=()=>{
   if(scrollFrame.current)return
   scrollFrame.current=requestAnimationFrame(()=>{scrollFrame.current=0;markScroll()})
  }
  document.addEventListener('scroll',onScroll,{passive:true,capture:true})
  return()=>{document.removeEventListener('scroll',onScroll,true);cancelAnimationFrame(scrollFrame.current);if(scrollEnd.current)window.clearTimeout(scrollEnd.current);scrollingRef.current=false}
 },[mobile])
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{document.documentElement.toggleAttribute('data-mobile-keyboard',window.innerHeight-viewport.height>150)};viewport.addEventListener('resize',update);update();return()=>{viewport.removeEventListener('resize',update);document.documentElement.removeAttribute('data-mobile-keyboard')}},[])
 const select=(path:string)=>{navigator.vibrate?.(8);navigate(path)}
 if(!mobile)return null
 return <><nav className={`mobile-app-dock${scrolling&&!more?' is-scrolling':''}`} aria-label="Navegação principal mobile" style={{'--mobile-dock-opacity':`${opacity}%`} as React.CSSProperties}><MobileDockIndicator index={index}/><div className="mobile-dock-items">{primaryMobileNavigation.map((item,itemIndex)=><button key={item.id} aria-label={item.label} aria-current={index===itemIndex?'page':undefined} className={index===itemIndex?'active':''} onClick={()=>select(item.path)}><item.icon/><span>{item.label}</span></button>)}<button aria-label="Mais módulos" aria-haspopup="dialog" aria-expanded={more} aria-current={index===4?'page':undefined} className={index===4||more?'active':''} onClick={()=>{navigator.vibrate?.(8);setMore(true)}}><Grid2X2/><span>Mais</span></button></div></nav><MobileMoreSheet open={more} onClose={close}/></>
}
