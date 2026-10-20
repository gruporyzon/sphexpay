import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { useProfilePhoto } from '../../hooks/useProfilePhoto'
export function ProfileAvatar({className='',onClick}:{className?:string;onClick?:()=>void}){useAppLocale(state=>state.locale);const {url,status}=useProfilePhoto();const content=url?<img src={url} alt="Foto de Ronald Rodriguez"/>:<span><T>RR</T></span>;return onClick?<button type="button" aria-label={uiText("Abrir opções da foto de perfil")} className={`profile-photo ${className} ${status==='loading'?'loading':''}`} onClick={onClick}>{content}</button>:<div className={`profile-photo ${className} ${status==='loading'?'loading':''}`}>{content}</div>}
