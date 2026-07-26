import { beforeEach,describe,expect,it,vi } from 'vitest'

const api=vi.hoisted(()=>({getUser:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:{auth:{getUser:api.getUser}}}))
import { isCurrentUserAdmin } from '../services/dashboardService'

describe('isCurrentUserAdmin',()=>{
 beforeEach(()=>vi.clearAllMocks())
 it('autoriza app_metadata emitido pelo Supabase Auth',async()=>{api.getUser.mockResolvedValue({data:{user:{app_metadata:{role:'admin'}}},error:null});expect(await isCurrentUserAdmin()).toBe(true)})
 it('mantém usuário comum bloqueado',async()=>{api.getUser.mockResolvedValue({data:{user:{app_metadata:{role:'authenticated'}}},error:null});expect(await isCurrentUserAdmin()).toBe(false)})
 it('não aceita user_metadata como papel administrativo',async()=>{api.getUser.mockResolvedValue({data:{user:{app_metadata:{},user_metadata:{role:'admin'}}},error:null});expect(await isCurrentUserAdmin()).toBe(false)})
 it('diferencia erro real de usuário não autorizado',async()=>{api.getUser.mockResolvedValue({data:{user:null},error:{message:'unavailable'}});await expect(isCurrentUserAdmin()).rejects.toThrow('ADMIN_ROLE_UNAVAILABLE')})
})
