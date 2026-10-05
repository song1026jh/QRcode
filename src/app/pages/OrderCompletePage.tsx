import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Home, Receipt } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { motion } from 'motion/react';

export default function OrderCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table') || '?';
  const { clearCart } = useCart();

  useEffect(() => {
    // 주문 완료 시 장바구니 비우기
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-border overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <div className="size-20 mx-auto rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-primary" />
              </div>
            </motion.div>

            <div className="space-y-2">
              <div className="text-2xl text-muted-foreground mb-1">♠ ♥ ♦ ♣</div>
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                주문이 완료되었습니다!
              </h1>
              <p className="text-muted-foreground text-sm">
                테이블 {tableNumber}번
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                서버가 결제내역을 확인하러 옵니다!
                <br />
                결제화면을 보여주세요.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => navigate('/?table=' + tableNumber)}
              >
                <Home className="size-4 mr-2" />
                메뉴로 돌아가기
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-border text-foreground hover:bg-card"
                onClick={() => navigate('/order-history?table=' + tableNumber)}
              >
                <Receipt className="size-4 mr-2" />
                결제하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}