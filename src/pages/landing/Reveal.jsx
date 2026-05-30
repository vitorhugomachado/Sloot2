import { useInView } from '../../hooks/useInView';

export default function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
  ...rest
}) {
  const [ref, inView] = useInView();

  return (
    <Tag
      ref={ref}
      className={`landing-reveal ${inView ? 'landing-reveal--visible' : ''} ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
