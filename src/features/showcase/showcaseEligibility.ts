export const SHOWCASE_TARGET_CENTS = 100_000
export type ShowcaseStatus = 'locked' | 'eligible' | 'published'
export type ShowcaseProduct = {
 id: string
 name: string
 category: string
 imageUrl: string | null
 grossSalesCents: number
 status: ShowcaseStatus
 publishedAt: string | null
}

export function getProductShowcaseEligibility(grossSalesCents: number, publishedAt: string | null = null) {
 const total = Number.isSafeInteger(grossSalesCents) && grossSalesCents > 0 ? grossSalesCents : 0
 const eligible = total >= SHOWCASE_TARGET_CENTS
 return {
  status: (eligible ? publishedAt ? 'published' : 'eligible' : 'locked') as ShowcaseStatus,
  eligible,
  remainingCents: Math.max(0, SHOWCASE_TARGET_CENTS - total),
  progress: Math.min(100, total / SHOWCASE_TARGET_CENTS * 100),
 }
}
