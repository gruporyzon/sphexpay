import { beforeEach,describe,expect,it,vi } from 'vitest'

const api=vi.hoisted(()=>({rpc:vi.fn(),maybeSingle:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:{rpc:api.rpc,from:()=>({select:()=>({maybeSingle:api.maybeSingle})})}}))
import { isCurrentUserAdmin } from '../services/dashboardService'

describe('isCurrentUserAdmin',()=>{
 beforeEach(()=>vi.clearAllMocks())
 it('usa a função protegida quando ela existe',async()=>{api.rpc.mockResolvedValue({data:true,error:null});expect(await isCurrentUserAdmin()).toBe(true);expect(api.maybeSingle).not.toHaveBeenCalled()})
 it('usa profiles.role do próprio usuário quando a migration está pendente',async()=>{api.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});api.maybeSingle.mockResolvedValue({data:{role:'Admin'},error:null});expect(await isCurrentUserAdmin()).toBe(true)})
 it('mantém usuário comum bloqueado',async()=>{api.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});api.maybeSingle.mockResolvedValue({data:{role:'Player'},error:null});expect(await isCurrentUserAdmin()).toBe(false)})
 it('diferencia erro real de usuário não autorizado',async()=>{api.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});api.maybeSingle.mockResolvedValue({data:null,error:{message:'unavailable'}});await expect(isCurrentUserAdmin()).rejects.toThrow('ADMIN_ROLE_UNAVAILABLE')})
})
