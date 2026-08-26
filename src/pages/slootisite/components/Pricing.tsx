import { motion, useInView } from 'framer-motion'
import { Check } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  BILLING_OPTIONS,
  PLAN_PRICING,
} from '../../landing2/landing2.config'
import { LANDING_WHATSAPP_URL } from '../../landing-teste/landingContact.config'
import { WordsPullUp } from './WordsPullUp'

const PLAN_FEATURES = [
  'Agendamentos ilimitados',
  'Barbeiros e clientes ilimitados',
  'Financeiro, estoque e comissões',
  'Suporte prioritário',
]

const EASE = [0.16, 1, 0.3, 1] as const
type BillingCycle = 'monthly' | 'annual'
const DEFAULT_PRICING_BILLING: BillingCycle = 'annual'
const BILLING_DISPLAY_ORDER: BillingCycle[] = ['annual', 'monthly']

export function Pricing() {
  const sectionRef = useRef<HTMLElement>(null)
  const billingButtonRefs = useRef<Partial<Record<BillingCycle, HTMLButtonElement | null>>>({})
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [billing, setBilling] = useState<BillingCycle>(DEFAULT_PRICING_BILLING)
  const isAnnual = billing === 'annual'
  const activePrice = isAnnual
    ? PLAN_PRICING.annualInstallmentValue
    : PLAN_PRICING.monthly
  const formattedPrice = activePrice.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const [integer, fraction] = formattedPrice.split(',')
  const annualSavings = Math.round(
    (1 - PLAN_PRICING.annualInstallmentValue / PLAN_PRICING.monthly) * 100,
  )
  const annualCashPrice = PLAN_PRICING.annualCash.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const priceLabel = isAnnual
    ? `${PLAN_PRICING.annualInstallments} parcelas de R$ ${formattedPrice} por mês, ou ${annualCashPrice} à vista no ano`
    : `R$ ${formattedPrice} por mês`

  const selectBilling = (nextBilling: BillingCycle, focus = false) => {
    setBilling(nextBilling)
    if (focus) {
      window.requestAnimationFrame(() => billingButtonRefs.current[nextBilling]?.focus())
    }
  }

  const handleBillingKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentBilling: BillingCycle,
  ) => {
    let nextBilling: BillingCycle | null = null

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home') {
      nextBilling = 'annual'
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End') {
      nextBilling = 'monthly'
    }

    if (!nextBilling || nextBilling === currentBilling) return
    event.preventDefault()
    selectBilling(nextBilling, true)
  }

  return (
    <section ref={sectionRef} id="planos" className="ss-pricing" aria-labelledby="ss-pricing-title">
      <div className="ss-pricing__noise ss-noise ss-noise--fine" aria-hidden />
      <div className="ss-pricing__ambient" aria-hidden />

      <div className="ss-pricing__inner">
        <motion.div
          className="ss-pricing__brand"
          initial={{ y: 24, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
          transition={{ duration: 0.75, ease: EASE }}
          aria-label="Slooti Barbers"
        >
          <WordsPullUp text="Slooti" orangeIDot as="span" className="ss-pricing__wordmark" />
          <span className="ss-pricing__brand-detail">Barbers</span>
        </motion.div>
        <motion.p
          className="ss-pricing__eyebrow"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.14, duration: 0.7 }}
        >
          Gestão. Agenda. Crescimento.
        </motion.p>

        <motion.header
          className="ss-pricing__head"
          initial={{ y: 32, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : { y: 32, opacity: 0 }}
          transition={{ delay: 0.12, duration: 0.8, ease: EASE }}
        >
          <h2 id="ss-pricing-title" className="ss-pricing__title">
            Planos e <em>Preços</em>
          </h2>
          <p className="ss-pricing__subtitle">
            O plano ideal para manter sua barbearia organizada e sempre no topo.
          </p>
        </motion.header>

        <motion.article
          className="ss-pricing__card"
          initial={{ y: 54, opacity: 0, scale: 0.97 }}
          animate={isInView ? { y: 0, opacity: 1, scale: 1 } : { y: 54, opacity: 0, scale: 0.97 }}
          transition={{ delay: 0.24, duration: 0.9, ease: EASE }}
        >
          <div className="ss-pricing__card-light" aria-hidden />

          <h3 className="ss-pricing__plan-name">
            Plano <em>Completo</em>
          </h3>
          <p className="ss-pricing__plan-description">
            Tudo o que você precisa para atender, organizar e crescer.
          </p>

          <div className="ss-pricing__billing-row">
            <span className="ss-pricing__billing-line" aria-hidden />
            <div
              className={`ss-pricing__billing-toggle is-${billing}`}
              role="tablist"
              aria-label="Período de cobrança"
            >
              <span className="ss-pricing__billing-indicator" aria-hidden />
              {BILLING_DISPLAY_ORDER.map((optionId) => {
                const option = BILLING_OPTIONS.find((item) => item.id === optionId)
                const isActive = billing === optionId

                return (
                  <button
                    key={optionId}
                    ref={(button) => {
                      billingButtonRefs.current[optionId] = button
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="ss-pricing-price"
                    tabIndex={isActive ? 0 : -1}
                    className={`ss-pricing__billing-option${isActive ? ' is-active' : ''}`}
                    onClick={() => selectBilling(optionId)}
                    onKeyDown={(event) => handleBillingKeyDown(event, optionId)}
                  >
                    {option?.label ?? (optionId === 'annual' ? 'Anual' : 'Mensal')}
                  </button>
                )
              })}
            </div>
            <span
              className="ss-pricing__saving"
              aria-label={`Economize ${annualSavings}% no plano anual`}
            >
              Economize {annualSavings}%
            </span>
            <span className="ss-pricing__billing-line" aria-hidden />
          </div>

          <motion.div
            key={billing}
            id="ss-pricing-price"
            className={`ss-pricing__price${isAnnual ? ' is-annual' : ''}`}
            role="tabpanel"
            aria-label={priceLabel}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            {isAnnual ? (
              <span className="ss-pricing__installments" aria-hidden>
                {PLAN_PRICING.annualInstallments}x de
              </span>
            ) : null}
            <span className="ss-pricing__price-main" aria-hidden>
              <span className="ss-pricing__currency">R$</span>
              <span className="ss-pricing__amount">{integer}</span>
              <span className="ss-pricing__comma">,</span>
              <span className="ss-pricing__cents">{fraction}</span>
            </span>
            <span className="ss-pricing__period" aria-hidden>/ mês</span>
            {isAnnual ? (
              <span className="ss-pricing__annual-note" aria-hidden>
                ou {annualCashPrice} à vista no ano
              </span>
            ) : null}
          </motion.div>

          <ul className="ss-pricing__features">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature}>
                <Check className="ss-pricing__check" strokeWidth={2.2} aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <a
            className="ss-pricing__cta"
            href={LANDING_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contratar agora
          </a>
          <p className="ss-pricing__fine-print">Sem fidelidade. Cancele quando quiser.</p>
        </motion.article>

        <motion.p
          className="ss-pricing__closing"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          Tecnologia que organiza. Resultado que sua barbearia sente.
        </motion.p>
      </div>
    </section>
  )
}
