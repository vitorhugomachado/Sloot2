import { motion, useInView } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { WordsPullUpMultiStyle } from './WordsPullUpMultiStyle'

const FEATURE_VIDEO = '/feature-canvas.mp4?v=202607310013'

const CARD_EASE = [0.22, 1, 0.36, 1] as const

const SLOOTI_LOGO = '/slooti-logo.png'

const CARDS = [
  {
    type: 'video' as const,
    title: 'Your creative canvas.',
  },
  {
    type: 'checklist' as const,
    number: '01',
    title: 'Slooti Barbers',
    icon: SLOOTI_LOGO,
    href: '/landingslootibarbers',
    backgroundImage: '/card-slooti-barbers-bg.png',
    items: [
      'Agendamento Online 24/7',
      'Gestão Financeira e Comissões',
      'Agenda individualizada',
      'Barbeiros ilimitados',
    ],
  },
]

function FeatureCard({
  children,
  index,
  className = '',
}: {
  children: React.ReactNode
  index: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [lifted, setLifted] = useState(false)

  return (
    <motion.div
      ref={ref}
      className={`ss-feature-card${lifted ? ' ss-feature-card--lifted' : ''} ${className}`.trim()}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
      whileHover={{
        y: -10,
        scale: 1.04,
        transition: { delay: 0, duration: 0.35, ease: CARD_EASE },
      }}
      onHoverStart={() => setLifted(true)}
      onHoverEnd={() => setLifted(false)}
      onFocus={() => setLifted(true)}
      onBlur={() => setLifted(false)}
      transition={{
        delay: index * 0.15,
        duration: 0.7,
        ease: CARD_EASE,
      }}
    >
      {children}
    </motion.div>
  )
}

export function Features() {
  return (
    <section id="solucoes" className="ss-features">
      <div className="ss-features__noise ss-noise ss-noise--fine" />

      <div className="ss-features__inner">
        <div className="ss-features__head">
          <WordsPullUpMultiStyle
            className="ss-features__line ss-features__line--cream"
            segments={[{ text: 'Software que transforma ideias em resultados.' }]}
          />
          <WordsPullUpMultiStyle
            className="ss-features__line ss-features__line--muted"
            segments={[{ text: 'Construído para inovar. Preparado para escalar.' }]}
          />
        </div>

        <div className="ss-features__grid">
          {CARDS.map((card, index) => {
            if (card.type === 'video') {
              return (
                <FeatureCard key={card.title} index={index}>
                  <video
                    className="ss-feature-card__video"
                    src={FEATURE_VIDEO}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  <div className="ss-feature-card__shade" />
                </FeatureCard>
              )
            }

            const linkInner = (
              <>
                Saiba mais
                <ArrowRight className="ss-feature-card__link-arrow" />
              </>
            )

            return (
              <FeatureCard
                key={card.title}
                index={index}
                className={`ss-feature-card--panel${card.backgroundImage ? ' ss-feature-card--has-bg' : ''}`}
              >
                {card.backgroundImage ? (
                  <>
                    <img
                      className="ss-feature-card__bg"
                      src={card.backgroundImage}
                      alt=""
                    />
                    <div className="ss-feature-card__bg-shade" />
                  </>
                ) : null}

                <div className="ss-feature-card__body">
                  {card.icon ? (
                    <img
                      src={card.icon}
                      alt={card.title === 'Slooti Barbers' ? 'Slooti Barbers' : card.title}
                      className="ss-feature-card__icon"
                    />
                  ) : null}

                  <div className="ss-feature-card__meta">
                    <span className="ss-feature-card__num">{card.number}</span>
                    <h3 className="ss-feature-card__title">{card.title}</h3>
                  </div>

                  <ul className="ss-feature-card__list">
                    {card.items.map((item) => (
                      <li key={item} className="ss-feature-card__item">
                        <Check className="ss-feature-card__check" />
                        <span className="ss-feature-card__item-text">{item}</span>
                      </li>
                    ))}
                  </ul>

                  {card.href.startsWith('/') ? (
                    <Link to={card.href} className="ss-feature-card__link">
                      {linkInner}
                    </Link>
                  ) : (
                    <a
                      href={card.href}
                      className="ss-feature-card__link"
                      {...(card.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {linkInner}
                    </a>
                  )}
                </div>
              </FeatureCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
