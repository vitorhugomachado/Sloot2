import React from 'react';

const paths = {
  cut: (
    <>
      <circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" />
      <path d="m9.5 15.3 9-11.3M14.5 15.3 5.5 4M10.2 13.9l3.6-4.4" />
    </>
  ),
  beard: (
    <>
      <path d="M7 5.5c1.5-1.4 3.1-2 5-2s3.5.6 5 2l1 5.5c.8 4.4-1.4 8.3-6 9.5-4.6-1.2-6.8-5.1-6-9.5L7 5.5Z" />
      <path d="M8.2 10.5c1.2 1.2 2.5 1.7 3.8 1.7s2.6-.5 3.8-1.7M9.2 15.1c.8.9 1.7 1.3 2.8 1.3s2-.4 2.8-1.3" />
    </>
  ),
  combo: (
    <>
      <circle cx="5" cy="17.5" r="2.3" /><circle cx="12" cy="17.5" r="2.3" />
      <path d="m6.8 16 7.3-11M10.2 15.8 3.8 5.2" />
      <path d="M15.5 10.5c1.2-.9 2.5-1 3.8-.2l.7 3.7c.5 2.8-.9 5.4-3.9 6.2-1.1-.3-2-.8-2.7-1.5" />
    </>
  ),
  razor: <path d="M4 7.5h10.5l3.5 3.2-2 2.3H9l-5-5.5Zm5 5.5 7.5 7M17.8 10.5 20 8.2" />,
  color: (
    <>
      <path d="m5 4 7 7M7.5 2.5l2 2M12 11l-6.8 8.2a2 2 0 0 0 2.9 2.7L16 14" />
      <path d="M14.5 5.5c1.5 2 3.5 3.2 5.5 3.5-1.1 2.2-2.6 3.3-4.5 3.3" />
    </>
  ),
  eyebrow: (
    <>
      <path d="M3 13c2.4-3.2 5.4-4.8 9-4.8s6.6 1.6 9 4.8c-2.4 2.7-5.4 4-9 4s-6.6-1.3-9-4Z" />
      <circle cx="12" cy="12.6" r="2.2" /><path d="M5 6.8c4.7-2 9.3-2 14 0" />
    </>
  ),
  generic: (
    <>
      <path d="m12 3 1.4 4.2L18 8.5l-4.6 1.3L12 14l-1.4-4.2L6 8.5l4.6-1.3L12 3Z" />
      <path d="m18.5 14 .8 2.3 2.2.7-2.2.7-.8 2.3-.8-2.3-2.2-.7 2.2-.7.8-2.3Z" />
    </>
  ),
};

export default function ServiceBookingIcon({ icon = 'generic', size = 46, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[icon] || paths.generic}
    </svg>
  );
}
