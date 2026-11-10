import { getImageProps, type ImageProps } from 'next/image'

// Fotografias sem estado/interações não precisam hidratar um componente de imagem.
// O Next continua gerando os URLs otimizados, srcset, sizes e formatos modernos.
type Props = Omit<ImageProps, 'placeholder' | 'blurDataURL' | 'preload' | 'priority' | 'onLoad' | 'onError' | 'onLoadingComplete'>
export default function ImagemOtimizada(opcoes: Props) {
  const { props } = getImageProps(opcoes)
  return <picture><img {...props} alt={opcoes.alt} /></picture>
}
