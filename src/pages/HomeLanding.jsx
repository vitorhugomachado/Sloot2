import { Suspense, lazy } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import TabLoadingFallback from '../components/TabLoadingFallback';
import LandingPage from '../pages/landing-teste/LandingTestePage';

const Landing2Page = lazy(() => import('../pages/landing2/Landing2Page'));

/** Mobile (≤768px): página de vendas. Desktop: landing principal. */
export default function HomeLanding() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <Suspense fallback={<TabLoadingFallback />}>
        <Landing2Page />
      </Suspense>
    );
  }

  return <LandingPage />;
}
