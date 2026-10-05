import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { CartItemCard } from '../components/CartItemCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { createOrder, getTablePartySize, getTableTimedDishCount } from '../services/orderService';
import { toast } from 'sonner';

export default function CartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table') || '?';
  const [isOrdering, setIsOrdering] = useState(false);
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    getTotalItems,
    clearCart,
  } = useCart();

  const handleOrder = async () => {
    if (cartItems.length === 0) return;

    setIsOrdering(true);

    try {
      // Calculate timerEnd
      const timerKey = `timerEnd_${tableNumber}`;
      const existing = sessionStorage.getItem(timerKey);
      const cartTimedDishCount = cartItems
        .filter(i => i.category === 'main' || i.category === 'side')
        .reduce((sum, i) => sum + i.quantity, 0);

      const [partySize, prevTimedDishCount] = await Promise.all([
        getTablePartySize(tableNumber),
        existing ? getTableTimedDishCount(tableNumber) : Promise.resolve(0),
      ]);
      const requiredMains = Math.ceil((partySize ?? 2) / 2);

      // After the required mains are covered, every additional main or side adds 30 minutes.
      const prevExtra = Math.max(0, prevTimedDishCount - requiredMains);
      const newExtra = Math.max(0, prevTimedDishCount + cartTimedDishCount - requiredMains);
      const additionalMins = (newExtra - prevExtra) * 30;

      let newTimerEnd: number;
      if (!existing) {
        newTimerEnd = Date.now() + (90 + additionalMins) * 60 * 1000;
      } else {
        newTimerEnd = parseInt(existing) + additionalMins * 60 * 1000;
      }

      const result = await createOrder(tableNumber, cartItems, getTotalPrice(), newTimerEnd);

      if (result.success) {
        sessionStorage.setItem(timerKey, String(newTimerEnd));

        toast.success('주문이 접수되었습니다!');
        navigate('/order-complete?table=' + tableNumber);
      } else {
        toast.error('주문 중 오류가 발생했습니다.');
        setIsOrdering(false);
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error('주문 중 오류가 발생했습니다.');
      setIsOrdering(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/?table=' + tableNumber)}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 mr-2" />
            메뉴로 돌아가기
          </Button>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="size-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              장바구니가 비어있습니다
            </h2>
            <p className="text-muted-foreground mb-6">
              메뉴를 선택해주세요
            </p>
            <Button onClick={() => navigate('/?table=' + tableNumber)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              메뉴 보기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/?table=' + tableNumber)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 mr-2" />
            메뉴로 돌아가기
          </Button>
          <div className="text-right">
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>장바구니</h1>
            <p className="text-sm text-muted-foreground">
              테이블 {tableNumber}번
            </p>
          </div>
        </div>

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {cartItems.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
            />
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">총 수량</span>
                  <span>{getTotalItems()}개</span>
                </div>
                {/* Chip items summary */}
                {cartItems.some(i => i.paymentType === 'chip') && (() => {
                  const chipTotal = cartItems
                    .filter(i => i.paymentType === 'chip')
                    .reduce((s, i) => s + (i.chipPrice ?? 0) * i.quantity, 0);
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-violet-600">🎰 칩 결제 항목</span>
                      <span className="text-violet-700 font-medium">{chipTotal}칩</span>
                    </div>
                  );
                })()}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">현금 결제 금액</span>
                  <span className="text-xl font-bold">
                    {getTotalPrice().toLocaleString()}원
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleOrder}
                disabled={isOrdering}
              >
                {isOrdering ? '주문 중...' : '주문하기'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
