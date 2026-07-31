import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { STUDIO_WHATSAPP_URL } from '../../landing-teste/landingContact.config'
import { WordsPullUp } from './WordsPullUp'

const NAV_ITEMS = [
  { label: 'Nossa História', href: '#nossa-historia' },
  { label: 'Soluções', href: '#solucoes' },
  {
    label: 'Contato',
    href: STUDIO_WHATSAPP_URL,
    external: true,
  },
]

/** Hero da home institucional. */
const HERO_VIDEO = '/hero-barbershop-test.mp4?v=1'

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
                <a
                  href={item.href}
                  className="ss-hero__nav-link"
                  {...(item.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
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
