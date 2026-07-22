export const passwordScore=(value:string)=>[value.length>=8,/[A-Z]/.test(value),/[a-z]/.test(value),/\d/.test(value),/[^A-Za-z0-9]/.test(value)].filter(Boolean).length
