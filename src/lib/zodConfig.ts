import { z } from 'zod'

// Sem compilação dinâmica (new Function): o site roda com CSP sem 'unsafe-eval'.
z.config({ jitless: true })
