import { useEffect, useState, useMemo } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Receipt,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  subscribeToOrders,
  updateItemServed,
  markTableAsPaid,
  clearTableOrders,
  Order,
  OrderItem,
} from "../services/orderService";
import { toast } from "sonner";

type TabMode = "service" | "payment";

interface DisplayItem {
  foodId: string;
  foodNameKo: string;
  quantity: number;
  price: number;
  kitchenReady: number;
  served: number;
  itemIndex: number;
  orderId: string;
  orderTime: any;
  noKitchen?: boolean;
  orderPaid: boolean;
  itemPaid: boolean;
}

interface TableData {
  tableNumber: string;
  displayItems: DisplayItem[];
  paidAmount: number;
  unpaidAmount: number;
  allPaid: boolean;
  hasPendingService: boolean;
  hasReadyToServe: boolean;
  timerEnd?: number;
}

function formatTime(timestamp: any) {
  if (!timestamp) return "--:--";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatEndTime(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}

const TABLE_GROUPS = [
  { label: "1–4", min: 1, max: 4 },
  { label: "5–8", min: 5, max: 8 },
  { label: "9–12", min: 9, max: 12 },
  { label: "13–16", min: 13, max: 16 },
  { label: "17–20", min: 17, max: 20 },
  { label: "21–24", min: 21, max: 24 },
];

export default function ServerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabMode>("service");
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [groupIndex, setGroupIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToOrders((newOrders) => {
      setOrders(newOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const tableSummaries = useMemo<TableData[]>(() => {
    const tableMap = new Map<
      string,
      { orders: Order[] }
    >();

    orders.forEach((order) => {
      if (order.status === "cancelled") return;
      const existing = tableMap.get(order.tableNumber);
      if (existing) {
        existing.orders.push(order);
      } else {
        tableMap.set(order.tableNumber, { orders: [order] });
      }
    });

    return Array.from(tableMap.entries())
      .map(([tableNumber, data]) => {
        const sortedOrders = [...data.orders].sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

        const displayItems: DisplayItem[] = [];
        sortedOrders.forEach((order) => {
          order.items.forEach((item: OrderItem, idx) => {
            if (item.id.startsWith("game-")) return;

            // 아이템 단위 결제 여부: order.paid OR item.itemPaid
            const effectivePaid = order.paid || (item.itemPaid ?? false);
            displayItems.push({
              foodId: item.id,
              foodNameKo: item.nameKo,
              quantity: item.quantity,
              price: item.price,
              kitchenReady: item.kitchenReady ?? 0,
              served: item.served ?? 0,
              itemIndex: idx,
              orderId: order.id!,
              orderTime: order.createdAt,
              noKitchen: item.noKitchen ?? false,
              orderPaid: effectivePaid,
              itemPaid: effectivePaid,
            });
          });
        });

        // 아이템 단위로 금액 계산
        const paidAmount = displayItems
          .filter((i) => i.itemPaid)
          .reduce((s, i) => s + i.price * i.quantity, 0);
        const unpaidAmount = displayItems
          .filter((i) => !i.itemPaid)
          .reduce((s, i) => s + i.price * i.quantity, 0);
        const allPaid = displayItems.every((i) => i.itemPaid);

        displayItems.sort((a, b) => {
          const aReady = a.kitchenReady >= a.quantity && a.served < a.quantity;
          const bReady = b.kitchenReady >= b.quantity && b.served < b.quantity;
          const aServed = a.served >= a.quantity;
          const bServed = b.served >= b.quantity;
          if (aReady && !bReady) return -1;
          if (!aReady && bReady) return 1;
          if (aServed && !bServed) return 1;
          if (!aServed && bServed) return -1;
          const ta = a.orderTime?.toMillis?.() ?? 0;
          const tb = b.orderTime?.toMillis?.() ?? 0;
          return ta - tb;
        });

        const nonGameItems = displayItems.filter((i) => !i.foodId.startsWith("game-"));
        const hasReadyToServe = nonGameItems.some(
          (i) => i.kitchenReady >= i.quantity && i.served < i.quantity,
        );
        const hasPendingService = nonGameItems.some((i) => i.served < i.quantity);

        const timerEnd = sortedOrders.reduce<number | undefined>((max, o) => {
          if (o.timerEnd === undefined) return max;
          return max === undefined ? o.timerEnd : Math.max(max, o.timerEnd);
        }, undefined);

        return {
          tableNumber,
          displayItems,
          paidAmount,
          unpaidAmount,
          allPaid,
          hasReadyToServe,
          hasPendingService,
          timerEnd,
        };
      })
      .filter((table) => table.displayItems.length > 0)
      .sort((a, b) => parseInt(a.tableNumber) - parseInt(b.tableNumber));
  }, [orders]);

  const groupedSummaries = groupIndex === null
    ? tableSummaries
    : tableSummaries.filter((t) => {
        const n = parseInt(t.tableNumber);
        return n >= TABLE_GROUPS[groupIndex].min && n <= TABLE_GROUPS[groupIndex].max;
      });

  const serviceTables = groupedSummaries.filter((t) => t.hasPendingService);
  const readyCount = groupedSummaries.filter((t) => t.hasReadyToServe).length;

  const handleServeItem = async (item: DisplayItem) => {
    const key = `${item.orderId}-${item.itemIndex}`;
    setProcessingKey(key);
    const result = await updateItemServed(item.orderId, item.itemIndex, item.quantity);
    setProcessingKey(null);
    if (result.success) {
      toast.success(`${item.foodNameKo} 서빙 완료`);
    } else {
      toast.error("업데이트에 실패했습니다");
    }
  };

  const handleUndoServe = async (item: DisplayItem) => {
    const key = `${item.orderId}-${item.itemIndex}-undo`;
    setProcessingKey(key);
    const result = await updateItemServed(item.orderId, item.itemIndex, item.served - 1);
    setProcessingKey(null);
    if (!result.success) toast.error("업데이트에 실패했습니다");
  };

  const handlePayment = async (tableNumber: string) => {
    const result = await markTableAsPaid(tableNumber);
    if (result.success) toast.success(`테이블 ${tableNumber}번 결제 완료`);
    else toast.error("결제 처리에 실패했습니다");
  };

  const handleClearTable = async (tableNumber: string) => {
    if (!confirm(`테이블 ${tableNumber}번 주문 내역을 초기화할까요?\n(결제 완료된 주문만 삭제됩니다)`)) return;
    const result = await clearTableOrders(tableNumber);
    if (result.success) toast.success(`테이블 ${tableNumber}번 초기화 완료`);
    else toast.error("초기화에 실패했습니다");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-12 mx-auto mb-4 animate-spin text-gray-400" />
          <p className="text-gray-500">서버 화면 로딩중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: "light" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <BellRing className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">서버 화면</h1>
              <p className="text-sm text-gray-500">실시간 서빙 현황</p>
            </div>
          </div>
          {readyCount > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-semibold text-sm">
                {readyCount}개 테이블 서빙 대기
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Table group selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setGroupIndex(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              groupIndex === null
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            전체
          </button>
          {TABLE_GROUPS.map((g, i) => {
            const groupActive = tableSummaries.some((t) => {
              const n = parseInt(t.tableNumber);
              return n >= g.min && n <= g.max;
            });
            const groupReady = tableSummaries.some((t) => {
              const n = parseInt(t.tableNumber);
              return n >= g.min && n <= g.max && t.hasReadyToServe;
            });
            return (
              <button
                key={i}
                onClick={() => setGroupIndex(i)}
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  groupIndex === i
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {g.label}번
                {groupReady && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
                {!groupReady && groupActive && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6">
          <button
            onClick={() => setTab("service")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "service"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UtensilsCrossed className="size-4" />
            서빙 현황
            {readyCount > 0 && (
              <span className="size-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">
                {readyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("payment")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "payment"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <DollarSign className="size-4" />
            결제 관리
          </button>
        </div>

        {/* Service Tab */}
        {tab === "service" && (
          serviceTables.length === 0 ? (
            <div className="text-center py-24">
              <CheckCircle2 className="size-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-500 mb-2">서빙 대기 중인 테이블이 없습니다</h2>
              <p className="text-gray-400">모든 음식이 서빙 완료되었습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {serviceTables.map((table) => (
                <ServiceTableCard
                  key={table.tableNumber}
                  table={table}
                  processingKey={processingKey}
                  onServeItem={handleServeItem}
                  onUndoServe={handleUndoServe}
                />
              ))}
            </div>
          )
        )}

        {/* Payment Tab */}
        {tab === "payment" && (
          groupedSummaries.length === 0 ? (
            <div className="text-center py-24">
              <Receipt className="size-20 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-500 mb-2">활성 테이블이 없습니다</h2>
              <p className="text-gray-400">주문이 있는 테이블이 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedSummaries.map((table) => (
                <PaymentTableCard
                  key={table.tableNumber}
                  table={table}
                  onPayment={handlePayment}
                  onClearTable={handleClearTable}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// --- Service Table Card ---

interface ServiceTableCardProps {
  table: TableData;
  processingKey: string | null;
  onServeItem: (item: DisplayItem) => void;
  onUndoServe: (item: DisplayItem) => void;
}

function ServiceTableCard({ table, processingKey, onServeItem, onUndoServe }: ServiceTableCardProps) {
  const nonGameItems = table.displayItems.filter((i) => !i.foodId.startsWith("game-"));
  const readyItems = nonGameItems.filter(
    (i) => i.kitchenReady >= i.quantity && i.served < i.quantity,
  );
  const pendingItems = nonGameItems.filter(
    (i) => i.kitchenReady < i.quantity && i.served < i.quantity,
  );
  const servedItems = nonGameItems.filter((i) => i.served >= i.quantity);

  return (
    <div
      className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
        table.hasReadyToServe
          ? "border-emerald-400 shadow-emerald-100"
          : "border-gray-200"
      }`}
    >
      {/* Card Header */}
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">테이블 {table.tableNumber}번</h3>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {table.hasReadyToServe && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500 text-white">
              서빙 대기
            </span>
          )}
          {pendingItems.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-300 text-amber-600">
              조리중 {pendingItems.length}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-2">
        {readyItems.map((item) => {
          const key = `${item.orderId}-${item.itemIndex}`;
          const isProcessing = processingKey === key;
          return (
            <div
              key={key}
              className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-semibold text-emerald-800">{item.foodNameKo}</p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-0.5">
                  <Clock className="size-3" />
                  <span>{formatTime(item.orderTime)}</span>
                  <span>· {item.quantity}개 {item.noKitchen ? "바로 서빙" : "준비완료"}</span>
                </div>
              </div>
              <button
                onClick={() => onServeItem(item)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                서빙
              </button>
            </div>
          );
        })}

        {pendingItems.map((item) => (
          <div
            key={`${item.orderId}-${item.itemIndex}`}
            className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 opacity-70"
          >
            <div>
              <p className="font-medium text-amber-800">{item.foodNameKo}</p>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-0.5">
                <Clock className="size-3" />
                <span>{formatTime(item.orderTime)}</span>
                <span>· {item.quantity}개</span>
              </div>
            </div>
            <span className="text-xs text-amber-600 font-medium px-2 py-1 rounded-lg bg-amber-100">
              조리중
            </span>
          </div>
        ))}

        {servedItems.map((item) => {
          const key = `${item.orderId}-${item.itemIndex}`;
          const isProcessing = processingKey === key + "-undo";
          return (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-2 rounded-xl"
            >
              <div className="flex items-center gap-2 opacity-40">
                <CheckCircle2 className="size-4 text-gray-400 shrink-0" />
                <p className="text-sm line-through text-gray-500">
                  {item.foodNameKo} ×{item.quantity}
                </p>
              </div>
              <button
                onClick={() => onUndoServe(item)}
                disabled={!!processingKey}
                className="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-400 text-xs hover:border-gray-400 hover:text-gray-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <>↩ 취소</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Payment Table Card ---

interface PaymentTableCardProps {
  table: TableData;
  onPayment: (tableNumber: string) => void;
  onClearTable: (tableNumber: string) => void;
}

function PaymentTableCard({ table, onPayment, onClearTable }: PaymentTableCardProps) {
  const paidItems = table.displayItems.filter((i) => i.orderPaid);
  const unpaidItems = table.displayItems.filter((i) => !i.orderPaid);
  const hasPartialPayment = paidItems.length > 0 && unpaidItems.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Card Header */}
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">테이블 {table.tableNumber}번</h3>
          {table.allPaid ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500 text-white">결제완료</span>
          ) : hasPartialPayment ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500 text-white">추가 주문</span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-300 text-gray-600">미결제</span>
          )}
        </div>
        {table.timerEnd && (() => {
          const expired = Date.now() > table.timerEnd;
          return (
            <div className={`flex items-center gap-1.5 text-sm mt-1.5 ${expired ? "text-red-500" : "text-gray-500"}`}>
              <Clock className="size-3.5 shrink-0" />
              {expired
                ? <span className="font-medium text-red-500">이용 시간 종료</span>
                : <span>이용 종료 <span className="font-semibold text-gray-700">{formatEndTime(table.timerEnd)}</span></span>
              }
            </div>
          );
        })()}
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-4">
        {unpaidItems.length > 0 && (
          <div className="space-y-1.5">
            {hasPartialPayment && (
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">추가 주문</p>
            )}
            {unpaidItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-700">
                <span>{item.foodNameKo} ×{item.quantity}</span>
                <span className="font-medium">{(item.price * item.quantity).toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}

        {paidItems.length > 0 && (
          <>
            {unpaidItems.length > 0 && <div className="border-t border-gray-200" />}
            <div className="space-y-1.5">
              {hasPartialPayment && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">결제 완료</p>
              )}
              {paidItems.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-400">
                  <span className="line-through">{item.foodNameKo} ×{item.quantity}</span>
                  <span className="line-through">{(item.price * item.quantity).toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-gray-200" />

        {hasPartialPayment ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>기결제 금액</span>
              <span className="line-through">{table.paidAmount.toLocaleString()}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">추가 결제 금액</span>
              <span className="text-2xl font-bold text-gray-900">
                {table.unpaidAmount.toLocaleString()}원
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">
              {table.allPaid ? "결제 완료 금액" : "총 결제 금액"}
            </span>
            <span className={`text-2xl font-bold ${table.allPaid ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {(table.paidAmount + table.unpaidAmount).toLocaleString()}원
            </span>
          </div>
        )}

        <button
          disabled={table.allPaid}
          onClick={() => onPayment(table.tableNumber)}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {table.allPaid
            ? "결제 완료됨"
            : table.unpaidAmount === 0
            ? "결제 완료 처리 (0원)"
            : hasPartialPayment
            ? `추가 결제 완료 (${table.unpaidAmount.toLocaleString()}원)`
            : "결제 완료 처리"}
        </button>

        {table.allPaid && (
          <button
            onClick={() => onClearTable(table.tableNumber)}
            className="w-full h-11 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="size-4" />
            주문 내역 초기화
          </button>
        )}
      </div>
    </div>
  );
}
