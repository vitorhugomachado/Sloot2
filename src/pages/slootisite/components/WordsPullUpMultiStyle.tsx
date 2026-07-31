import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

export interface TextSegment {
  text: string
  className?: string
}

interface WordsPullUpMultiStyleProps {
  segments: TextSegment[]
  className?: string
}

export function WordsPullUpMultiStyle({
  segments,
  className = '',
}: WordsPullUpMultiStyleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const words = segments.flatMap((segment) =>
    segment.text.split(' ').map((word) => ({
      word,
      className: segment.className ?? '',
    })),
  )

  return (
    <div ref={ref} className={`ss-words-multi ${className}`.trim()}>
      <span className="ss-words-multi__row">
        {words.map((item, i) => (
          <span key={`${item.word}-${i}`} className="ss-words-multi__unit">
            <motion.span
              className={`ss-words-multi__motion ${item.className}`.trim()}
              initial={{ y: '100%', opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : { y: '100%', opacity: 0 }}
              transition={{
                delay: i * 0.08,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {item.word}
              {i < words.length - 1 ? '\u00A0' : ''}
            </motion.span>
          </span>
        ))}
      </span>
    </div>
  )
}
