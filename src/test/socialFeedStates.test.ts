import {act,renderHook,waitFor} from '@testing-library/react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {socialService} from '../features/social/socialService'
import {useSocialFeed} from '../features/social/useSocial'
import type {SocialPost} from '../features/social/types'

const post:SocialPost={id:'post-1',authorId:'user-1',body:'checkout',createdAt:'2026-08-13T00:00:00Z',updatedAt:'2026-08-13T00:00:00Z',profile:{userId:'user-1',username:'creator_1',displayName:'Creator',bio:'',badges:[]},media:[],likes:0,comments:0,reposts:0,liked:false,bookmarked:false,following:false}

describe('estados do feed Social',()=>{
 afterEach(()=>vi.restoreAllMocks())
 it('encerra loading em sucesso vazio sem criar erro',async()=>{vi.spyOn(socialService,'feed').mockResolvedValue([]);const {result}=renderHook(()=>useSocialFeed('user-1','for-you'));expect(result.current.loading).toBe(true);await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.posts).toEqual([]);expect(result.current.error).toBe('');expect(result.current.done).toBe(true)})
 it('entrega publicações válidas e preserva fallback de perfil sem avatar',async()=>{vi.spyOn(socialService,'feed').mockResolvedValue([post]);const {result}=renderHook(()=>useSocialFeed('user-1','for-you'));await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.posts).toEqual([post]);expect(result.current.posts[0].profile.avatarUrl).toBeUndefined();expect(result.current.error).toBe('')})
 it('distingue falha de resultado vazio e encerra paginação',async()=>{vi.spyOn(socialService,'feed').mockRejectedValue(new Error('PGRST201'));const {result}=renderHook(()=>useSocialFeed('user-1','for-you'));await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.error).toBe('Não conseguimos carregar o feed.');expect(result.current.posts).toEqual([]);expect(result.current.done).toBe(true)})
 it('retry refaz a query e troca erro por sucesso',async()=>{const feed=vi.spyOn(socialService,'feed').mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([post]);const {result}=renderHook(()=>useSocialFeed('user-1','for-you'));await waitFor(()=>expect(result.current.error).not.toBe(''));await act(async()=>{await result.current.reload()});expect(feed).toHaveBeenCalledTimes(2);expect(result.current.error).toBe('');expect(result.current.posts).toEqual([post])})
 it('consulta o modo Seguindo sem converter ausência de posts em erro',async()=>{const feed=vi.spyOn(socialService,'feed').mockResolvedValue([]);const {result}=renderHook(()=>useSocialFeed('user-1','following'));await waitFor(()=>expect(result.current.loading).toBe(false));expect(feed).toHaveBeenCalledWith('user-1','following',undefined,undefined,undefined);expect(result.current.error).toBe('')})
})
