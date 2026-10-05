import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gamepad2,
  Receipt,
  UtensilsCrossed,
} from 'lucide-react';
import { Order, subscribeToTableOrders } from '../services/orderService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';

function formatDateTime(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusBadge(status: Order['status']) {
  if (status === 'pending') return <Badge variant="destructive">주문 접수</Badge>;
  if (status === 'preparing') return <Badge className="bg-yellow-500">준비 중</Badge>;
  if (status === 'completed') return <Badge className="bg-green-500">완료</Badge>;
  return <Badge variant="outline">취소됨</Badge>;
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table') || '?';
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToTableOrders(tableNumber, setOrders);
    return () => unsubscribe();
  }, [tableNumber]);

  const paymentSummary = useMemo(() => {
    const unpaidItems = orders.flatMap((order) =>
      order.items.filter((item) => !order.paid && !item.itemPaid),
    );
    const gameItems = unpaidItems.filter((item) => item.id.startsWith('game-'));
    const foodItems = unpaidItems.filter((item) => !item.id.startsWith('game-'));
    const getAmount = (items: typeof unpaidItems) =>
      items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      gameItems,
      foodItems,
      gameAmount: getAmount(gameItems),
      foodAmount: getAmount(foodItems),
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/?table=' + tableNumber)}>
            <ArrowLeft className="size-4 mr-2" />
            메뉴로 돌아가기
          </Button>
          <div className="text-right">
            <h1 className="text-xl font-bold">주문 내역</h1>
            <p className="text-sm text-muted-foreground">테이블 {tableNumber}번</p>
          </div>
        </div>

        {orders.length > 0 && (
          <>
            <Card className="mb-4 bg-primary text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm opacity-90">전체 주문 금액</p>
                    <p className="text-3xl font-bold mt-1">
                      {orders.reduce((sum, order) => sum + order.totalPrice, 0).toLocaleString()}원
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">총 주문 건수</p>
                    <p className="text-2xl font-bold mt-1">{orders.length}건</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(paymentSummary.gameItems.length > 0 || paymentSummary.foodItems.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {paymentSummary.gameItems.length > 0 && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-violet-300 text-violet-800 hover:bg-violet-50"
                    onClick={() => navigate('/payment?table=' + tableNumber + '&type=game')}
                  >
                    <Gamepad2 className="size-5 mr-2" />
                    게임 결제하기 ({paymentSummary.gameAmount.toLocaleString()}원)
                  </Button>
                )}
                {paymentSummary.foodItems.length > 0 && (
                  <Button
                    size="lg"
                    className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={() => navigate('/payment?table=' + tableNumber + '&type=food')}
                  >
                    <UtensilsCrossed className="size-5 mr-2" />
                    음식 결제하기 ({paymentSummary.foodAmount.toLocaleString()}원)
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Receipt className="size-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">주문 내역이 없습니다</h2>
            <p className="text-muted-foreground mb-6">메뉴에서 주문을 시작해 보세요.</p>
            <Button onClick={() => navigate('/?table=' + tableNumber)}>메뉴 보기</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderPaid = order.paid || order.items.every((item) => item.itemPaid);
              return (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">주문 #{order.id?.slice(-6).toUpperCase()}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="size-3" />
                          {formatDateTime(order.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {getStatusBadge(order.status)}
                        {orderPaid ? (
                          <Badge className="bg-blue-500">결제 완료</Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700">미결제</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {order.items.map((item, index) => {
                        const itemPaid = order.paid || item.itemPaid;
                        const isGame = item.id.startsWith('game-');
                        return (
                          <div key={index} className="flex gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.nameKo}
                                className="size-16 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium">{item.nameKo}</p>
                                    {isGame && <Badge variant="outline" className="text-violet-700 border-violet-300">게임</Badge>}
                                    {itemPaid && (
                                      <Badge className="bg-blue-500">
                                        <CheckCircle2 className="size-3 mr-1" />
                                        결제 완료
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{item.name}</p>
                                </div>
                                <p className={`font-semibold shrink-0 ${itemPaid ? 'text-muted-foreground line-through' : ''}`}>
                                  {(item.price * item.quantity).toLocaleString()}원
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                수량: {item.quantity}개 x {item.price.toLocaleString()}원
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="font-semibold">총 금액</span>
                      <span className="text-xl font-bold">{order.totalPrice.toLocaleString()}원</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
