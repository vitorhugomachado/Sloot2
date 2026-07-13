import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';
import TabLoadingFallback from '../components/TabLoadingFallback';

const Landing2Page = lazy(() => import('../pages/landing2/Landing2Page'));

/** /paginadevendas — só mobile. Desktop redireciona para a home. */
export default function PaginadeVendasRoute() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (!isMobile) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <Landing2Page />
    </Suspense>
  );
}
