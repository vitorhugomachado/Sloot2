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
  'Desenvolvemos soluções inteligentes que transformam a forma como empresas operam, crescem e inovam.',
  'Criamos plataformas, sistemas e experiências digitais que unem tecnologia, design e performance para resolver desafios reais e impulsionar resultados.',
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
            { text: 'Soluções', className: 'ss-about__title-seg' },
            { text: 'Digitais', className: 'ss-serif' },
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
