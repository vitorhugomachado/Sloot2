import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { WordsPullUpMultiStyle } from './WordsPullUpMultiStyle'

function AnimatedLetter({
  children,
  index,
  totalChars,
  progress,
}: {
  children: string
  index: number
  totalChars: number
  progress: MotionValue<number>
}) {
  const charProgress = index / totalChars
  const opacity = useTransform(
    progress,
    [charProgress - 0.1, charProgress + 0.05],
    [0.2, 1],
  )

  return (
    <motion.span style={{ opacity }} className="ss-about__char">
      {children}
    </motion.span>
  )
}

const BODY_PARAGRAPHS = [
  'A Slooti nasceu da vontade de unir design, tecnologia e resultados reais para negócios que querem crescer com inteligência.',
  'Construímos produtos digitais — como o Slooti Barbers e o Neura — que transformam operação, experiência e escala em uma mesma jornada.',
]

export function About() {
  const paragraphRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: paragraphRef,
    offset: ['start 0.8', 'end 0.2'],
  })

  return (
    <section id="nossa-historia" className="ss-about">
      <div className="ss-about__panel">
        <WordsPullUpMultiStyle
          className="ss-about__title"
          segments={[
            { text: 'Nossa', className: 'ss-about__title-seg' },
            { text: 'História', className: 'ss-serif' },
          ]}
        />

        <div ref={paragraphRef} className="ss-about__body">
          {BODY_PARAGRAPHS.map((paragraph, pIndex) => {
            const offset = BODY_PARAGRAPHS.slice(0, pIndex).join('').length
            return (
              <p key={paragraph}>
                {paragraph.split('').map((char, index) => (
                  <AnimatedLetter
                    key={`${pIndex}-${index}`}
                    index={offset + index}
                    totalChars={BODY_PARAGRAPHS.join('').length}
                    progress={scrollYProgress}
                  >
                    {char}
                  </AnimatedLetter>
                ))}
              </p>
            )
          })}
        </div>
      </div>
    </section>
  )
}
