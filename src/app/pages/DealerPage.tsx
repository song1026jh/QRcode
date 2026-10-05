import { useEffect, useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Minus,
  Plus,
  Gamepad2,
  UtensilsCrossed,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  subscribeToOrders,
  markGameComplete,
  undoGameComplete,
  cancelDealerOrder,
  createDealerOrder,
  Order,
  OrderItem,
} from "../services/orderService";
import { menuItems as allMenuItems, menuCategories } from "../data/menu";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";

function formatTime(timestamp: any) {
  if (!timestamp) return "--:--";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function baseGameId(itemId: string) {
  return itemId.replace(/-chip$|-money$/, "");
}

interface PendingGame {
  orderId: string;
  itemIndex: number;
  tableNumber: string;
  nameKo: string;
  quantity: number;
  served: number;
  chipPayment: boolean;
  chipPrice: number | null;
  moneyPrice: number | null;
  orderTime: any;
}

interface DealerAddition {
  orderId: string;
  tableNumber: string;
  items: Array<{ nameKo: string; quantity: number }>;
  orderTime: any;
}

interface TableGames {
  tableNumber: string;
  pending: PendingGame[];
  completed: PendingGame[];
  dealerAdditions: DealerAddition[];
}

export default function DealerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const [addMenuTable, setAddMenuTable] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [modalCategory, setModalCategory] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToOrders((newOrders) => {
      setOrders(newOrders);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const tableGames = useMemo<TableGames[]>(() => {
    const map = new Map<string, TableGames>();

    const getOrCreate = (tableNumber: string): TableGames => {
      if (!map.has(tableNumber)) {
        map.set(tableNumber, { tableNumber, pending: [], completed: [], dealerAdditions: [] });
      }
      return map.get(tableNumber)!;
    };

    orders.forEach((order) => {
      if (order.status === "cancelled") return;

      // Dealer-added free menu items
      if (order.dealerOrder) {
        const entry = getOrCreate(order.tableNumber);
        entry.dealerAdditions.push({
          orderId: order.id!,
          tableNumber: order.tableNumber,
          items: order.items.map((i) => ({ nameKo: i.nameKo, quantity: i.quantity })),
          orderTime: order.createdAt,
        });
        return;
      }

      // Game items
      order.items.forEach((item: OrderItem, idx) => {
        if (!item.id.startsWith("game-")) return;

        const isChip = item.id.endsWith("-chip");
        const menuItem = allMenuItems.find((m) => m.id === baseGameId(item.id));
        const entry = getOrCreate(order.tableNumber);

        const game: PendingGame = {
          orderId: order.id!,
          itemIndex: idx,
          tableNumber: order.tableNumber,
          nameKo: item.nameKo,
          quantity: item.quantity,
          served: item.served ?? 0,
          chipPayment: isChip,
          chipPrice: isChip && menuItem?.chipPrice ? menuItem.chipPrice : null,
          moneyPrice: !isChip && menuItem?.price ? menuItem.price : null,
          orderTime: order.createdAt,
        };

        if ((item.served ?? 0) >= item.quantity) {
          entry.completed.push(game);
        } else {
          entry.pending.push(game);
        }
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => parseInt(a.tableNumber) - parseInt(b.tableNumber),
    );
  }, [orders]);

  const pendingCount = tableGames.reduce((s, t) => s + t.pending.length, 0);

  const handleComplete = async (game: PendingGame) => {
    const key = `${game.orderId}-${game.itemIndex}`;
    setProcessingKey(key);
    const result = await markGameComplete(game.orderId, game.itemIndex, game.quantity);
    setProcessingKey(null);
    if (result.success) toast.success(`${game.nameKo} 게임 완료!`);
    else toast.error("업데이트에 실패했습니다");
  };

  const handleUndoGame = async (game: PendingGame) => {
    const key = `${game.orderId}-${game.itemIndex}-undo`;
    setProcessingKey(key);
    const result = await undoGameComplete(game.orderId, game.itemIndex);
    setProcessingKey(null);
    if (result.success) toast.success(`${game.nameKo} 완료 취소됨`);
    else toast.error("되돌리기에 실패했습니다");
  };

  const handleCancelAddition = async (addition: DealerAddition) => {
    const key = `cancel-${addition.orderId}`;
    setProcessingKey(key);
    const result = await cancelDealerOrder(addition.orderId);
    setProcessingKey(null);
    if (result.success) {
      toast.success("추가 메뉴가 취소되었습니다");
    } else {
      toast.error("취소에 실패했습니다");
    }
  };

  const openAddMenu = (tableNumber: string) => {
    setAddMenuTable(tableNumber);
    setSelectedItems(new Map());
    setModalCategory("all");
  };

  const updateQty = (itemId: string, delta: number) => {
    const next = new Map(selectedItems);
    const cur = next.get(itemId) ?? 0;
    const newQty = cur + delta;
    if (newQty <= 0) next.delete(itemId);
    else next.set(itemId, newQty);
    setSelectedItems(next);
  };

  const handleAddMenu = async () => {
    if (!addMenuTable || selectedItems.size === 0) return;
    setIsSubmitting(true);
    const items = Array.from(selectedItems.entries()).map(([itemId, quantity]) => {
      const menuItem = allMenuItems.find((m) => m.id === itemId)!;
      return {
        id: menuItem.id,
        name: menuItem.name,
        nameKo: menuItem.nameKo,
        image: menuItem.image,
        noKitchen: menuItem.noKitchen ?? false,
        quantity,
      };
    });
    const result = await createDealerOrder(addMenuTable, items);
    setIsSubmitting(false);
    if (result.success) {
      toast.success(`테이블 ${addMenuTable}번에 메뉴 추가 완료`);
      setAddMenuTable(null);
    } else {
      toast.error("메뉴 추가에 실패했습니다");
    }
  };

  const addableMenuItems = allMenuItems.filter((m) => m.category !== "game");
  const filteredMenuItems =
    modalCategory === "all"
      ? addableMenuItems
      : addableMenuItems.filter((m) => m.category === modalCategory);
  const addableCategories = menuCategories.filter((c) => c.id !== "game");
  const totalSelectedQty = Array.from(selectedItems.values()).reduce((s, v) => s + v, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-violet-500 flex items-center justify-center">
              <Gamepad2 className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">딜러 화면</h1>
              <p className="text-sm text-gray-500">게임 주문 관리</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-2">
              <div className="size-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-violet-700 font-semibold text-sm">대기 {pendingCount}건</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {tableGames.length === 0 && (
          <div className="text-center py-32">
            <Gamepad2 className="size-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 mb-2">게임 주문이 없습니다</h2>
            <p className="text-gray-400">게임 주문이 들어오면 여기에 표시됩니다</p>
          </div>
        )}

        {/* Tables with activity — pending first */}
        {[
          ...tableGames.filter((t) => t.pending.length > 0),
          ...tableGames.filter((t) => t.pending.length === 0),
        ].map((table) => (
          <TableGameCard
            key={table.tableNumber}
            table={table}
            processingKey={processingKey}
            onComplete={handleComplete}
            onUndoGame={handleUndoGame}
            onCancelAddition={handleCancelAddition}
            onAddMenu={openAddMenu}
          />
        ))}
      </div>

      {/* Add Menu Dialog */}
      <Dialog.Root
        open={addMenuTable !== null}
        onOpenChange={(open) => { if (!open) setAddMenuTable(null); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
              <div>
                <Dialog.Title className="text-lg font-bold">
                  테이블 {addMenuTable}번 메뉴 추가
                </Dialog.Title>
                <p className="text-sm text-gray-500 mt-0.5">
                  선택한 메뉴는 <span className="text-violet-600 font-semibold">0원</span>으로 추가됩니다
                </p>
              </div>
              <Dialog.Close asChild>
                <button className="size-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <X className="size-5 text-gray-500" />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-5 py-3 flex gap-2 overflow-x-auto shrink-0 border-b">
              {addableCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setModalCategory(cat.id)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    modalCategory === cat.id
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {filteredMenuItems.map((item) => {
                const qty = selectedItems.get(item.id) ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between py-3 px-4 rounded-xl transition-all ${
                      qty > 0 ? "bg-violet-50 border border-violet-200" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img src={item.image} alt={item.nameKo} className="size-12 rounded-lg object-cover" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.nameKo}</p>
                        <p className="text-sm text-gray-400 line-through">{item.price.toLocaleString()}원</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 ? (
                        <>
                          <button onClick={() => updateQty(item.id, -1)} className="size-8 rounded-full border border-violet-300 bg-white flex items-center justify-center hover:bg-violet-50 transition-colors">
                            <Minus className="size-3.5 text-violet-600" />
                          </button>
                          <span className="w-6 text-center font-semibold text-violet-700">{qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="size-8 rounded-full bg-violet-600 flex items-center justify-center hover:bg-violet-700 transition-colors">
                            <Plus className="size-3.5 text-white" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => updateQty(item.id, 1)} className="size-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-violet-400 hover:bg-violet-50 transition-colors">
                          <Plus className="size-3.5 text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t shrink-0">
              <Button
                size="lg"
                className="w-full bg-violet-600 hover:bg-violet-700"
                disabled={totalSelectedQty === 0 || isSubmitting}
                onClick={handleAddMenu}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <UtensilsCrossed className="size-4 mr-2" />}
                {totalSelectedQty > 0 ? `${totalSelectedQty}가지 무료 추가하기` : "메뉴를 선택해주세요"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// --- Table Game Card ---

interface TableGameCardProps {
  table: TableGames;
  processingKey: string | null;
  onComplete: (game: PendingGame) => void;
  onUndoGame: (game: PendingGame) => void;
  onCancelAddition: (addition: DealerAddition) => void;
  onAddMenu: (tableNumber: string) => void;
}

function TableGameCard({ table, processingKey, onComplete, onUndoGame, onCancelAddition, onAddMenu }: TableGameCardProps) {
  const hasPending = table.pending.length > 0;
  const hasContent =
    table.pending.length > 0 || table.completed.length > 0 || table.dealerAdditions.length > 0;

  if (!hasContent) return null;

  return (
    <Card className={`overflow-hidden border-2 ${hasPending ? "border-violet-300 shadow-md" : "border-gray-200"}`}>
      <CardHeader className={`pb-3 ${hasPending ? "bg-violet-50" : "bg-gray-50"}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-900">테이블 {table.tableNumber}번</CardTitle>
          <div className="flex items-center gap-2">
            {hasPending && (
              <Badge className="bg-violet-500 text-white">대기 {table.pending.length}건</Badge>
            )}
            <button
              onClick={() => onAddMenu(table.tableNumber)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700 text-sm font-medium transition-all"
            >
              <Plus className="size-3.5" />
              메뉴 추가
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-2 bg-white">

        {/* ── Pending games ── */}
        {table.pending.map((game) => {
          const key = `${game.orderId}-${game.itemIndex}`;
          const isProcessing = processingKey === key;
          const totalChips = game.chipPrice !== null ? game.chipPrice * game.quantity : null;
          const totalMoney = game.moneyPrice !== null ? game.moneyPrice * game.quantity : null;
          return (
            <div key={key} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{game.nameKo}</p>
                  {game.quantity > 1 && <span className="text-gray-400 text-sm">×{game.quantity}</span>}
                  {game.chipPayment ? (
                    <Badge className="bg-amber-100 text-amber-700 border border-amber-200 font-semibold">🎰 {totalChips}칩</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-700 border border-blue-200 font-semibold">💰 {totalMoney?.toLocaleString()}원</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                  <Clock className="size-3" />
                  <span>{formatTime(game.orderTime)}</span>
                </div>
              </div>
              <button
                onClick={() => onComplete(game)}
                disabled={!!processingKey}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-3"
              >
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                게임 완료
              </button>
            </div>
          );
        })}

        {/* ── Completed games (with undo) ── */}
        {table.completed.length > 0 && (
          <>
            {table.pending.length > 0 && <Separator className="my-1" />}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-1">완료된 게임</p>
            {table.completed.map((game) => {
              const key = `${game.orderId}-${game.itemIndex}-undo`;
              const isProcessing = processingKey === key;
              const totalChips = game.chipPrice !== null ? game.chipPrice * game.quantity : null;
              const totalMoney = game.moneyPrice !== null ? game.moneyPrice * game.quantity : null;
              return (
                <div key={key} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 opacity-50">
                    <CheckCircle2 className="size-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm line-through text-gray-500">
                        {game.nameKo}{game.quantity > 1 && ` ×${game.quantity}`}
                      </p>
                      <p className="text-xs text-gray-400 line-through">
                        {game.chipPayment ? `${totalChips}칩` : `${totalMoney?.toLocaleString()}원`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUndoGame(game)}
                    disabled={!!processingKey}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 text-xs font-medium hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
                  >
                    {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                    되돌리기
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ── Dealer additions (with cancel) ── */}
        {table.dealerAdditions.length > 0 && (
          <>
            {(table.pending.length > 0 || table.completed.length > 0) && <Separator className="my-1" />}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-1">추가 메뉴 내역</p>
            {table.dealerAdditions.map((addition) => {
              const key = `cancel-${addition.orderId}`;
              const isProcessing = processingKey === key;
              return (
                <div key={addition.orderId} className="flex items-start justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <UtensilsCrossed className="size-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700">무료 추가</span>
                      <span className="text-xs text-emerald-500">{formatTime(addition.orderTime)}</span>
                    </div>
                    <div className="space-y-0.5">
                      {addition.items.map((item, idx) => (
                        <p key={idx} className="text-sm text-emerald-900 font-medium">
                          {item.nameKo}{item.quantity > 1 && <span className="text-emerald-600 ml-1">×{item.quantity}</span>}
                          <span className="text-emerald-500 text-xs ml-1">(0원)</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onCancelAddition(addition)}
                    disabled={!!processingKey}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3 mt-0.5"
                  >
                    {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                    취소
                  </button>
                </div>
              );
            })}
          </>
        )}

      </CardContent>
    </Card>
  );
}
