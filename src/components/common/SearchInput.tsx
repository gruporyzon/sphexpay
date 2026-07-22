import { Search } from 'lucide-react'

export function SearchInput(){return <label className="top-search"><Search aria-hidden="true"/><span className="sr-only">Pesquisar na SphexPay</span><input type="search" aria-label="Buscar vendas, clientes e produtos" placeholder="Buscar vendas, clientes, produtos..." autoComplete="off"/></label>}
