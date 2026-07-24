export default function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 const configured=Boolean((process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL)&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)
 return response.status(200).json({success:true,configured})
}
