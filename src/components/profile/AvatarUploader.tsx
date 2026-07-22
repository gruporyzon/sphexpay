import { useState } from 'react'
import { Camera,ImagePlus,Trash2 } from 'lucide-react'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfilePhotoDialog } from './ProfilePhotoDialog'
import { useProfilePhoto } from '../../hooks/useProfilePhoto'

export function AvatarUploader({compact=false}:{compact?:boolean}){const [open,setOpen]=useState(false),[menu,setMenu]=useState(false),{url,remove}=useProfilePhoto();return <div className={`avatar-uploader ${compact?'compact':''}`}><ProfileAvatar onClick={()=>setMenu(value=>!value)}/><span className="avatar-camera"><Camera/></span>{menu&&<div className="avatar-menu" role="menu"><button role="menuitem" onClick={()=>{setOpen(true);setMenu(false)}}><ImagePlus/> Alterar foto</button>{url&&<button role="menuitem" onClick={()=>{void remove();setMenu(false)}}><Trash2/> Remover foto</button>}</div>}{open&&<ProfilePhotoDialog onClose={()=>setOpen(false)}/>}</div>}
