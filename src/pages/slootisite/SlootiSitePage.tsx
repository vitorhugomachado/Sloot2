import { useEffect } from 'react'
import { About } from './components/About'
import { Features } from './components/Features'
import { Hero } from './components/Hero'
import './slootisite.css'

export default function SlootiSitePage() {
  useEffect(() => {
    document.body.classList.add('slootisite-lock')
    return () => document.body.classList.remove('slootisite-lock')
  }, [])

  return (
    <div className="slootisite">
      <main className="slootisite-main">
        <Hero />
        <About />
        <Features />
      </main>
    </div>
  )
}
