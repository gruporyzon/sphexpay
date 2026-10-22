// Link de divulgação: o checkout do produto com o código do afiliado.
export const affiliateLink=(productId:string,publicId:string,origin=typeof location==='undefined'?'':location.origin)=>`${origin}/p/${productId}?ref=${publicId}`
