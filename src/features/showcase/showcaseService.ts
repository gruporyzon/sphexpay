import { supabase } from '../../lib/supabase'
import { getProductShowcaseEligibility, type ShowcaseProduct } from './showcaseEligibility'

function client() {
 if (!supabase) throw new Error('SHOWCASE_UNAVAILABLE')
 return supabase
}

export const showcaseService = {
 async list(): Promise<ShowcaseProduct[]> {
  const result: ShowcaseProduct[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
   const { data, error } = await client().rpc('list_my_showcase_products').range(offset, offset + pageSize - 1)
   if (error) throw error
   for (const row of data || []) {
    const grossSalesCents = Number(row.gross_sales_cents)
    const publishedAt = row.showcase_published_at || null
    result.push({ id: row.id, name: row.name, category: row.category || 'Sem categoria', imageUrl: row.image_url,
     grossSalesCents, publishedAt, status: getProductShowcaseEligibility(grossSalesCents, publishedAt).status })
   }
   if (!data || data.length < pageSize) return result
  }
 },
 async setPublished(productId: string, published: boolean) {
  const { error } = await client().rpc('set_product_showcase_publication', { p_product_id: productId, p_published: published })
  if (error) throw error
 },
}

export function showcaseError(error: unknown) {
 const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
 if (message.includes('SHOWCASE_SALES_REQUIRED')) return 'Este produto ainda não atingiu R$ 1.000,00 em vendas aprovadas. Atualize os dados para conferir o progresso.'
 if (message.includes('SHOWCASE_PRODUCT_UNAVAILABLE')) return 'Este produto não está mais disponível. Atualize a lista para continuar.'
 return 'Não foi possível atualizar a vitrine. Tente novamente em instantes.'
}
