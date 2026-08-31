export type AffiliateStatus='active'|'pending'|'suspended'|'inactive'
export type CommissionType='percentage'|'fixed'
export type AffiliateProduct={id:string;productId:string;productName:string;commissionType:CommissionType;commissionValue:number;currency:'BRL'|'USD'|'EUR'}
export type Affiliate={id:string;publicId:string;name:string;email:string|null;status:AffiliateStatus;joinedAt:string;products:AffiliateProduct[]}
export type AffiliateFilters={query:string;status:AffiliateStatus|'';productId:string;from:string;to:string}
export type AffiliatePage={items:Affiliate[];count:number;page:number;pageSize:number}
export type AffiliateProductOption={id:string;name:string}
