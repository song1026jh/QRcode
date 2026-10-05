import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  BellRing,
  CheckCircle,
  CreditCard,
  Gamepad2,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Order,
  PaymentRequestType,
  requestPayment,
  subscribeToTableOrders,
} from '../services/orderService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';

type PaymentKind = PaymentRequestType;

const paymentOptions: Record<PaymentKind, {
  title: string;
  description: string;
  staff: string;
  action: string;
  Icon: typeof Gamepad2;
}> = {
  game: {
    title: '게임 결제하기',
    description: '게임 이용 금액을 카카오페이로 결제합니다.',
    staff: '딜러가 테이블로 와서 결제를 확인합니다.',
    action: '카카오페이로 결제하기',
    Icon: Gamepad2,
  },
  food: {
    title: '음식 결제하기',
    description: '음식 주문 금액을 카카오페이로 결제합니다.',
    staff: '서버가 테이블로 와서 결제를 도와드립니다.',
    action: '카카오페이로 결제하기',
    Icon: UtensilsCrossed,
  },
};

function isPaymentItem(itemId: string, kind: PaymentKind) {
  return kind === 'game' ? itemId.startsWith('game-') : !itemId.startsWith('game-');
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table') || '?';
  const paymentTypeParam = searchParams.get('type');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedKind, setSelectedKind] = useState<PaymentKind>(
    paymentTypeParam === 'food' ? 'food' : 'game',
  );
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTableOrders(tableNumber, (newOrders) => {
      setOrders(newOrders.filter((order) => !order.paid));
    });
    return () => unsubscribe();
  }, [tableNumber]);

  useEffect(() => {
    if (paymentTypeParam === 'game' || paymentTypeParam === 'food') {
      setSelectedKind(paymentTypeParam);
    }
  }, [paymentTypeParam]);

  const paymentGroups = useMemo(() => {
    return (['game', 'food'] as PaymentKind[]).map((kind) => {
      const items = orders.flatMap((order) =>
        order.items
          .filter((item) => !item.itemPaid && isPaymentItem(item.id, kind))
          .map((item) => ({ ...item, orderId: order.id })),
      );
      return {
        kind,
        items,
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      };
    });
  }, [orders]);

  const selectedGroup = paymentGroups.find((group) => group.kind === selectedKind)!;
  const hasAnyUnpaidItems = paymentGroups.some((group) => group.items.length > 0);
  const selectedOption = paymentOptions[selectedKind];

  const handlePaymentRequest = async () => {
    if (selectedGroup.items.length === 0) return;
    window.open('https://qr.kakaopay.com/FGhbAM6kv', '_blank');
    setRequesting(true);
    setRequestError(false);
    const result = await requestPayment(tableNumber, selectedKind);
    setRequesting(false);
    if (!result.success) setRequestError(true);
  };

  if (!hasAnyUnpaidItems) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => navigate('/order-history?table=' + tableNumber)}>
            <ArrowLeft className="size-4 mr-2" />
            주문 내역으로 돌아가기
          </Button>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="size-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">결제할 주문이 없습니다</h2>
            <p className="text-muted-foreground mb-6">모든 주문이 결제되었습니다.</p>
            <Button onClick={() => navigate('/?table=' + tableNumber)}>메뉴로 돌아가기</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/order-history?table=' + tableNumber)}>
            <ArrowLeft className="size-4 mr-2" />
            주문 내역으로 돌아가기
          </Button>
          <div className="text-right">
            <h1 className="text-xl font-bold">결제하기</h1>
            <p className="text-sm text-muted-foreground">테이블 {tableNumber}번</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              결제 유형 선택
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(paymentOptions) as PaymentKind[]).map((kind) => {
                const option = paymentOptions[kind];
                const group = paymentGroups.find((entry) => entry.kind === kind)!;
                const Icon = option.Icon;
                const isSelected = kind === selectedKind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setSelectedKind(kind);
                      setRequestError(false);
                    }}
                    className={`border p-4 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">{option.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                        <p className="mt-3 font-bold">{group.total.toLocaleString()}원</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {selectedOption.title.replace('하기', '')} 내역 ({selectedGroup.items.length}개)
              </p>
              {selectedGroup.items.length > 0 ? selectedGroup.items.map((item, index) => (
                <div key={`${item.orderId}-${item.id}-${index}`} className="flex justify-between text-sm">
                  <span>{item.nameKo} x{item.quantity}</span>
                  <span className="text-muted-foreground">{(item.price * item.quantity).toLocaleString()}원</span>
                </div>
              )) : (
                <p className="py-4 text-sm text-muted-foreground">결제할 항목이 없습니다.</p>
              )}
            </div>

            <div className="bg-muted px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BellRing className="size-4 text-primary" />
                {selectedOption.staff}
              </div>
            </div>

            {requestError && (
              <p className="text-sm text-destructive">카카오페이는 열렸지만 직원 확인 요청을 전달하지 못했습니다. 직원에게 말씀해 주세요.</p>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handlePaymentRequest}
              disabled={requesting || selectedGroup.items.length === 0}
            >
              {requesting ? <Loader2 className="size-5 mr-2 animate-spin" /> : <BellRing className="size-5 mr-2" />}
              {selectedOption.action}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
