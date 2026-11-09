'use client'

import { useId, useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<ComponentProps<'input'>, 'type'> & { nomeCampo?: string }

export default function CampoSenha({ id, nomeCampo = 'senha', className = '', disabled, ...props }: Props) {
  const gerado = useId()
  const identificador = id || gerado
  const [visivel, setVisivel] = useState(false)
  const rotulo = `${visivel ? 'Ocultar' : 'Mostrar'} ${nomeCampo}`

  return <div className="relative min-w-0">
    <input {...props} id={identificador} type={visivel ? 'text' : 'password'} disabled={disabled} className={`${className} pr-14`} />
    <button type="button" disabled={disabled} aria-label={rotulo} title={rotulo} aria-controls={identificador} aria-pressed={visivel}
      onMouseDown={event => event.preventDefault()} onClick={() => setVisivel(atual => !atual)}
      className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded text-gray-500 transition hover:text-hb-gold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-hb-gold disabled:opacity-40">
      {visivel ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
    </button>
  </div>
}
