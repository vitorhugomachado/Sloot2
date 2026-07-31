import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { WordsPullUp } from './WordsPullUp'

const NAV_ITEMS = [
  { label: 'Nossa História', href: '#nossa-historia' },
  { label: 'Soluções', href: '#solucoes' },
  { label: 'Contato', href: '#contato' },
]

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4'

const EASE = [0.16, 1, 0.3, 1] as const

export function Hero() {
  return (
    <section className="ss-hero">
      <div className="ss-hero__frame">
        <video
          className="ss-hero__video"
          src={HERO_VIDEO}
          autoPlay
          loop
          muted
          playsInline
        />

        <div className="ss-hero__noise ss-noise" />
        <div className="ss-hero__shade" />

        <nav className="ss-hero__nav">
          <ul className="ss-hero__nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <a href={item.href} className="ss-hero__nav-link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ss-hero__bottom">
          <div className="ss-hero__grid">
            <div className="ss-hero__title-wrap">
              <WordsPullUp text="Slooti" orangeIDot className="ss-hero__title" />
            </div>

            <div className="ss-hero__cta-wrap">
              <motion.a
                href="#solucoes"
                className="ss-hero__cta"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.7, ease: EASE }}
              >
                <span className="ss-hero__cta-label">Conheça nossas soluções</span>
                <span className="ss-hero__cta-icon">
                  <ArrowRight className="ss-hero__cta-arrow" />
                </span>
              </motion.a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
