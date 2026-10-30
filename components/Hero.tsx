'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

const BANNERS = [
  {
    id: 1,
    titulo: "COLEÇÃO ELEGANCE",
    subtitulo: "Joias em Prata 925 com design exclusivo",
    imagem: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop", 
  },
  {
    id: 2,
    titulo: "H&H IMPORTS",
    subtitulo: "Relógios importados de alta precisão",
    imagem: "https://images.unsplash.com/photo-1547996160-81dfa63595dd?q=80&w=1974&auto=format&fit=crop",
  }
]

export default function Hero() {
  return (
    <section className="w-full h-[500px] md:h-[650px] bg-gray-100">
      <Swiper
        modules={[Autoplay, Pagination]}
        pagination={{ clickable: true }}
        autoplay={{ delay: 5000 }}
        className="h-full w-full"
      >
        {BANNERS.map((banner) => (
          <SwiperSlide key={banner.id}>
            <div 
              className="relative w-full h-full bg-cover bg-center flex items-center justify-center"
              style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${banner.imagem})` }}
            >
              <div className="text-center text-white px-4">
                <h2 className="text-sm tracking-[0.3em] mb-4 animate-fadeIn">NOVIDADES</h2>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">{banner.titulo}</h1>
                <p className="text-lg md:text-xl font-light mb-8">{banner.subtitulo}</p>
                <button className="bg-white text-black px-10 py-4 text-sm font-bold tracking-widest hover:bg-gray-200 transition">
                  VER AGORA
                </button>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}
