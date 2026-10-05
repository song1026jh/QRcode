import { useEffect, useState, useMemo } from "react";
import { ChefHat, CheckCircle2, UtensilsCrossed, Loader2 } from "lucide-react";
import {
  subscribeToOrders,
  updateItemKitchenReady,
  Order,
  OrderItem,
} from "../services/orderService";
import { toast } from "sonner";

interface FoodInstance {
  orderId: string;
  itemIndex: number;
  quantity: number;
  kitchenReady: number;
  orderTime: any;
}

interface KitchenItem {
  foodId: string;
  foodNameKo: string;
  totalPending: number;
  totalReady: number;
  // All instances sorted oldest-first (FIFO for 완료)
  // Newest instance with kitchenReady > 0 = undo target
  allInstances: FoodInstance[];
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToOrders((newOrders) => {
      setOrders(newOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const kitchenItems = useMemo<KitchenItem[]>(() => {
    const map = new Map<string, KitchenItem>();

    orders.forEach((order) => {
      if (order.status === "cancelled") return;

      order.items.forEach((item: OrderItem, idx) => {
        if (item.noKitchen) return;
        if (item.id.startsWith("game-")) return;

        const kitchenReady = item.kitchenReady ?? 0;
        const pending = item.quantity - kitchenReady;

        const existing = map.get(item.id) ?? {
          foodId: item.id,
          foodNameKo: item.nameKo,
          totalPending: 0,
          totalReady: 0,
          allInstances: [],
        };

        existing.totalPending += Math.max(0, pending);
        existing.totalReady += kitchenReady;
        existing.allInstances.push({
          orderId: order.id!,
          itemIndex: idx,
          quantity: item.quantity,
          kitchenReady,
          orderTime: order.createdAt,
        });

        map.set(item.id, existing);
      });
    });

    // Sort oldest-first (FIFO for 완료, newest-with-ready for 되돌리기)
    map.forEach((item) => {
      item.allInstances.sort((a, b) => {
        const ta = a.orderTime?.toMillis?.() ?? 0;
        const tb = b.orderTime?.toMillis?.() ?? 0;
        return ta - tb;
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.totalPending > 0 && b.totalPending === 0) return -1;
      if (a.totalPending === 0 && b.totalPending > 0) return 1;
      return a.foodNameKo.localeCompare(b.foodNameKo);
    });
  }, [orders]);

  const totalPending = kitchenItems.reduce((s, i) => s + i.totalPending, 0);

  // +1 on oldest pending instance (FIFO)
  const handleComplete = async (item: KitchenItem) => {
    if (item.totalPending === 0 || processingId) return;

    setProcessingId(item.foodId + "-complete");

    const target = item.allInstances.find(
      (i) => i.kitchenReady < i.quantity,
    );
    if (!target) { setProcessingId(null); return; }

    const result = await updateItemKitchenReady(
      target.orderId,
      target.itemIndex,
      target.kitchenReady + 1,
    );

    setProcessingId(null);
    if (!result.success) toast.error("업데이트에 실패했습니다");
  };

  // -1 on newest instance that has kitchenReady > 0 (undo = LIFO)
  const handleUndo = async (item: KitchenItem) => {
    if (item.totalReady === 0 || processingId) return;

    setProcessingId(item.foodId + "-undo");

    // Find the newest instance with kitchenReady > 0
    const target = [...item.allInstances]
      .reverse()
      .find((i) => i.kitchenReady > 0);
    if (!target) { setProcessingId(null); return; }

    const result = await updateItemKitchenReady(
      target.orderId,
      target.itemIndex,
      target.kitchenReady - 1,
    );

    setProcessingId(null);
    if (!result.success) toast.error("업데이트에 실패했습니다");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <ChefHat className="size-16 mx-auto mb-4 animate-pulse text-amber-400" />
          <p className="text-xl">주방 화면 로딩중...</p>
        </div>
      </div>
    );
  }

  const pendingItems = kitchenItems.filter((i) => i.totalPending > 0);
  const doneItems = kitchenItems.filter(
    (i) => i.totalPending === 0 && i.totalReady > 0,
  );

  const isCompleting = (foodId: string) => processingId === foodId + "-complete";
  const isUndoing = (foodId: string) => processingId === foodId + "-undo";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="size-8 text-amber-400" />
            <h1 className="text-2xl font-bold tracking-tight">주방 화면</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">조리 대기</p>
            <p className="text-4xl font-bold text-amber-400 leading-none">
              {totalPending}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {pendingItems.length === 0 && doneItems.length === 0 ? (
          <div className="text-center py-28">
            <UtensilsCrossed className="size-20 text-slate-700 mx-auto mb-4" />
            <p className="text-xl text-slate-500">주문이 없습니다</p>
          </div>
        ) : (
          <>
            {/* Pending items */}
            {pendingItems.map((item) => {
              const total = item.totalPending + item.totalReady;
              return (
                <div
                  key={item.foodId}
                  className="flex items-center justify-between bg-slate-800 border-2 border-amber-600/40 rounded-2xl px-6 py-5"
                >
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">{item.foodNameKo}</p>
                    <p className="text-sm text-slate-400">
                      {item.totalReady > 0
                        ? `${total}개 중 ${item.totalReady}개 완료`
                        : `${item.totalPending}개 대기중`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Remaining count */}
                    <div className="text-right">
                      <span className="text-5xl font-bold text-amber-400 leading-none">
                        {item.totalPending}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">남음</p>
                    </div>

                    {/* Undo button — only when something has been marked ready */}
                    {item.totalReady > 0 && (
                      <button
                        onClick={() => handleUndo(item)}
                        disabled={!!processingId}
                        className="w-14 h-20 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-300 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 border border-slate-600"
                      >
                        {isUndoing(item.foodId) ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <>
                            <span className="text-xl">↩</span>
                            <span className="text-xs">취소</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Complete button */}
                    <button
                      onClick={() => handleComplete(item)}
                      disabled={!!processingId}
                      className="w-20 h-20 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 active:bg-amber-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 shadow-lg shadow-amber-900/30"
                    >
                      {isCompleting(item.foodId) ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <>
                          <span className="text-2xl">✓</span>
                          <span className="text-xs">완료</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            {doneItems.length > 0 && pendingItems.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500">완료된 메뉴</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
            )}

            {/* Done items — show undo button to revert last completion */}
            {doneItems.map((item) => (
              <div
                key={item.foodId}
                className="flex items-center justify-between bg-slate-800/50 border border-emerald-900/50 rounded-2xl px-6 py-4"
              >
                <div className="flex items-center gap-3 opacity-50">
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  <p className="text-lg font-medium line-through text-slate-400">
                    {item.foodNameKo}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm opacity-50">
                    {item.totalReady}개 완료
                  </span>
                  <button
                    onClick={() => handleUndo(item)}
                    disabled={!!processingId}
                    className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-300 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600 flex items-center gap-1.5"
                  >
                    {isUndoing(item.foodId) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <span>↩</span>
                        <span>되돌리기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
