import { createBrowserRouter, useParams, useNavigate } from 'react-router';
import { useEffect } from 'react';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrderCompletePage from './pages/OrderCompletePage';
import KitchenPage from './pages/KitchenPage';
import ServerPage from './pages/ServerPage';
import DealerPage from './pages/DealerPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import PaymentPage from './pages/PaymentPage';

// Handles /1, /2, /table=1 etc. → /?table=1
function TableRedirect() {
  const { segment } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let table = segment ?? '';
    // Handle "table=1" path segment
    if (table.includes('=')) {
      table = table.split('=').pop() ?? '';
    }
    if (table && /^\d+$/.test(table)) {
      navigate(`/?table=${table}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [segment, navigate]);

  return null;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MenuPage,
  },
  {
    path: '/cart',
    Component: CartPage,
  },
  {
    path: '/order-complete',
    Component: OrderCompletePage,
  },
  {
    path: '/kitchen',
    Component: KitchenPage,
  },
  {
    path: '/server',
    Component: ServerPage,
  },
  {
    path: '/dealer',
    Component: DealerPage,
  },
  {
    path: '/order-history',
    Component: OrderHistoryPage,
  },
  {
    path: '/payment',
    Component: PaymentPage,
  },
  // Catch-all for /1, /2, /table=1, etc.
  {
    path: '/:segment',
    Component: TableRedirect,
  },
]);