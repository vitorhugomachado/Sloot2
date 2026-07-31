import { motion, useInView } from 'framer-motion'
import { useRef, type ElementType, type ReactNode } from 'react'

interface WordsPullUpProps {
  text: string
  className?: string
  orangeIDot?: boolean
  as?: ElementType
}

function withOrangeIDot(word: string): ReactNode {
  const last = word.slice(-1)
  if (last.toLowerCase() !== 'i') return word

  return (
    <>
      {word.slice(0, -1)}
      <span className="ss-words__idot">
        <span className="ss-words__idot-ghost">{last}</span>
        <span aria-hidden className="ss-words__idot-stem">
          {last}
        </span>
        <span aria-hidden className="ss-words__idot-dot" />
      </span>
    </>
  )
}

export function WordsPullUp({
  text,
  className = '',
  orangeIDot = false,
  as: Tag = 'h1',
}: WordsPullUpProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const words = text.split(' ')

  return (
    <Tag
      ref={ref}
      className={`ss-words ${className}${orangeIDot ? ' ss-words--open' : ''}`.trim()}
    >
      {words.map((word, i) => {
        const isLast = i === words.length - 1
        const content = orangeIDot && isLast ? withOrangeIDot(word) : word

        return (
          <span
            key={`${word}-${i}`}
            className={`ss-words__unit ${
              orangeIDot && isLast ? 'ss-words__unit--open' : 'ss-words__unit--clip'
            }`}
          >
            <motion.span
              className={`ss-words__motion${orangeIDot && isLast ? ' ss-words__unit--open' : ''}`}
              initial={{ y: 20, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
              transition={{
                delay: i * 0.08,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {content}
              {!isLast ? '\u00A0' : ''}
            </motion.span>
          </span>
        )
      })}
    </Tag>
  )
}
