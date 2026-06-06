import { useRef } from 'react';

function isFinePointer() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(pointer: fine)').matches;
}

export default function TiltCard({ className = '', children, intensity = 10, ...rest }) {
  const ref = useRef(null);
  const canTilt = isFinePointer();

  const handleMove = (e) => {
    if (!canTilt) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / rect.height) * -intensity;
    const rotateY = ((x - rect.width / 2) / rect.width) * intensity;
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleLeave = () => {
    if (!canTilt) return;
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  return (
    <div
      ref={ref}
      className={`lt-tilt${canTilt ? '' : ' lt-tilt--static'} ${className}`.trim()}
      onMouseMove={canTilt ? handleMove : undefined}
      onMouseLeave={canTilt ? handleLeave : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
