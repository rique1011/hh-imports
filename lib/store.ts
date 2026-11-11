import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProdutoCarrinho {
  id: string;
  nome: string;
  preco: number;
  foto: string;
  quantidade: number;
  slug?: string;
}

interface CartState {
  itens: ProdutoCarrinho[];
  wishlist: ProdutoCarrinho[];
  freteValor: number;
  cupom: { codigo: string; desconto: number } | null; // <-- NOVO: Cupom
  adicionarAoCarrinho: (produto: ProdutoCarrinho) => void;
  removerDoCarrinho: (id: string) => void;
  atualizarQuantidade: (id: string, quantidade: number) => void;
  limparCarrinho: () => void;
  toggleWishlist: (produto: ProdutoCarrinho) => void;
  setFreteValor: (valor: number) => void;
  aplicarCupom: (codigo: string, desconto: number) => void; // <-- NOVO
  removerCupom: () => void; // <-- NOVO
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      itens: [],
      wishlist: [],
      freteValor: 0,
      cupom: null,

      adicionarAoCarrinho: (produto) => set((state) => {
        const itemExiste = state.itens.find((i) => i.id === produto.id);
        if (itemExiste) {
          return { itens: state.itens.map((i) => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i) };
        }
        return { itens: [...state.itens, { ...produto, quantidade: 1 }] };
      }),

      removerDoCarrinho: (id) => set((state) => ({ itens: state.itens.filter((i) => i.id !== id) })),
      atualizarQuantidade: (id, quantidade) => {
        if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 100) return;
        set((state) => ({ itens: state.itens.map((i) => i.id === id ? { ...i, quantidade } : i) }));
      },
      limparCarrinho: () => set({ itens: [], freteValor: 0, cupom: null }),
      toggleWishlist: (produto) => set((state) => {
        const existe = state.wishlist.find((i) => i.id === produto.id);
        if (existe) return { wishlist: state.wishlist.filter((i) => i.id !== produto.id) };
        return { wishlist: [...state.wishlist, produto] };
      }),
      setFreteValor: (valor) => set({ freteValor: valor }),
      aplicarCupom: (codigo, desconto) => set({ cupom: { codigo, desconto } }),
      removerCupom: () => set({ cupom: null }),
    }),
    { name: 'hb-storage' }
  )
)
