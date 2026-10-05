import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import {
  Minus,
  Plus,
  ShoppingCart,
  Receipt,
  Users,
  Timer,
  AlertCircle,
} from "lucide-react";
import { menuItems, menuCategories } from "../data/menu";
import { useCart } from "../contexts/CartContext";
import {
  setTablePartySize,
  subscribeToTablePartySize,
  subscribeToTableOrders,
  resetTablePartySize,
} from "../services/orderService";
import { MenuItemCard } from "../components/MenuItemCard";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import brandBanner from "../../imports/image-1.png";

const SEAT_CHARGE = 5000;

function formatEndTime(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}

const seatChargeItem = {
  id: "seat-charge",
  name: "Seat Charge",
  nameKo: "자릿세",
  description: "1인당 자릿세",
  price: SEAT_CHARGE,
  category: "charge",
  image: "",
  noKitchen: true,
};

const SUITS = ["♠", "♥", "♦", "♣"];

export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || "?";
  const [selectedCategory, setSelectedCategory] =
    useState("all");
  const {
    addToCart,
    updateQuantity,
    clearCart,
    getTotalItems,
  } = useCart();

  const [partySize, setPartySize] = useState<
    number | null | "loading"
  >("loading");
  const [hasOrders, setHasOrders] = useState<boolean | null>(
    null,
  );
  const [pendingSize, setPendingSize] = useState(2);
  const [prePaid, setPrePaid] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToTablePartySize(
      tableNumber,
      (size) => {
        setPartySize(size);
      },
    );
    return () => unsub();
  }, [tableNumber]);

  // 주문 내역 구독 — 주문 여부 + timerEnd 추출
  useEffect(() => {
    const unsub = subscribeToTableOrders(
      tableNumber,
      (orders) => {
        setHasOrders(orders.length > 0);
        // 가장 최신 timerEnd를 Firestore orders에서 읽어옴
        const latest = orders.reduce<number | undefined>(
          (max, o) => {
            if (o.timerEnd === undefined) return max;
            return max === undefined
              ? o.timerEnd
              : Math.max(max, o.timerEnd);
          },
          undefined,
        );
        setEndTime(latest ?? null);
      },
    );
    return () => unsub();
  }, [tableNumber]);

  useEffect(() => {
    if (hasOrders === null) return;
    const confirmedKey = `partySizeConfirmed_${tableNumber}`;
    const confirmedThisSession =
      sessionStorage.getItem(confirmedKey) === "true";
    // 이 탭에서 인원 확인한 적 없고, 주문도 없으면 → Firestore partySize 초기화
    if (
      !confirmedThisSession &&
      hasOrders === false &&
      typeof partySize === "number"
    ) {
      resetTablePartySize(tableNumber);
    }
  }, [hasOrders, partySize, tableNumber]);

  useEffect(() => {
    const prevTable = sessionStorage.getItem("currentTable");
    if (prevTable !== null && prevTable !== tableNumber) {
      clearCart();
      sessionStorage.removeItem("timerEnd_" + prevTable);
      setEndTime(null);
      setPendingSize(2);
    }
    sessionStorage.setItem("currentTable", tableNumber);
  }, [tableNumber, clearCart]);

  const handlePartySizeConfirm = async () => {
    sessionStorage.setItem(
      `partySizeConfirmed_${tableNumber}`,
      "true",
    );
    await setTablePartySize(tableNumber, pendingSize);
    const chargePerPerson = prePaid ? 0 : SEAT_CHARGE;
    const customItem = { ...seatChargeItem, price: chargePerPerson };
    addToCart(customItem);
    if (pendingSize > 1) updateQuantity("seat-charge", pendingSize);
    if (prePaid) {
      toast.success("선결제 확인 완료 — 자릿세 0원으로 처리됩니다");
    } else {
      toast.success(`자릿세 ${(SEAT_CHARGE * pendingSize).toLocaleString()}원이 추가되었습니다`);
    }
  };

  const handleAddToCart = (
    item: any,
    paymentType?: "chip" | "money",
  ) => {
    if (item.category === "game" && paymentType) {
      addToCart({
        ...item,
        id: item.id + "-" + paymentType,
        price: paymentType === "chip" ? 0 : item.price,
        paymentType,
      });
    } else {
      addToCart(item);
    }
    const suffix =
      paymentType === "chip"
        ? " (칩 결제)"
        : paymentType === "money"
          ? " (현금 결제)"
          : "";
    toast.success(
      `${item.nameKo}가 장바구니에 추가되었습니다${suffix}`,
    );
  };

  const filteredItems =
    selectedCategory === "all"
      ? menuItems
      : menuItems.filter(
          (item) => item.category === selectedCategory,
        );

  // ── Loading ───────────────────────────────────────────────
  if (partySize === "loading" || hasOrders === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Party size screen ─────────────────────────────────────
  if (partySize === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
        {/* Background suit watermarks */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-5">
          {[
            "♠",
            "♥",
            "♦",
            "♣",
            "♠",
            "♥",
            "♦",
            "♣",
            "♠",
            "♥",
            "♦",
            "♣",
          ].map((s, i) => (
            <span
              key={i}
              className="absolute text-foreground"
              style={{
                fontSize: `${60 + (i % 3) * 40}px`,
                left: `${(i * 23 + 5) % 95}%`,
                top: `${(i * 17 + 10) % 90}%`,
                transform: `rotate(${(i % 4) * 15 - 15}deg)`,
              }}
            >
              {s}
            </span>
          ))}
        </div>

        <div className="w-full max-w-sm relative z-10 space-y-6">
          {/* Brand banner */}
          <div className="overflow-hidden rounded-2xl shadow-2xl shadow-primary/30 border border-primary/20">
            <ImageWithFallback
              src={brandBanner}
              alt="ADELAND 카지리노"
              className="w-full object-cover"
            />
          </div>

          {/* Table + welcome */}
          <div className="text-center space-y-1">
            <p
              className="text-muted-foreground text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Table {tableNumber}
            </p>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{
                fontFamily: "'Playfair Display', serif",
              }}
            >
              어서오세요 ✦
            </h1>
          </div>

          {/* Party size selector */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Users className="size-4" /> 몇 분이 오셨나요?
            </p>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setPendingSize(Math.max(1, pendingSize - 1))}
                className="size-14 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center text-foreground"
              >
                <Minus className="size-5" />
              </button>
              <div className="w-20 text-center">
                <span
                  className="text-6xl font-bold tabular-nums text-foreground"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {pendingSize}
                </span>
                <p className="text-xs text-muted-foreground mt-1">명</p>
              </div>
              <button
                onClick={() => setPendingSize(Math.min(20, pendingSize + 1))}
                className="size-14 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center text-foreground"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </div>

          {/* Pre-paid toggle */}
          <button
            onClick={() => setPrePaid(!prePaid)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
              prePaid
                ? "bg-primary/10 border-primary/50"
                : "bg-card border-border"
            }`}
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                자릿세 선결제 완료
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                사전예약으로 자릿세를 미리 내셨나요?
              </p>
            </div>
            <div
              className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 ${prePaid ? "bg-primary" : "bg-muted"}`}
            >
              <div
                className={`size-5 rounded-full bg-white shadow transition-all ${prePaid ? "translate-x-5" : "translate-x-0"}`}
              />
            </div>
          </button>

          {/* Seat charge breakdown */}
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>자릿세</span>
              <span className={prePaid ? "line-through" : ""}>{SEAT_CHARGE.toLocaleString()}원 × {pendingSize}명</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
              <span>합계</span>
              <span className={prePaid ? "text-muted-foreground line-through" : "text-primary"}>
                {(SEAT_CHARGE * pendingSize).toLocaleString()}원
              </span>
            </div>
            {prePaid && (
              <div className="flex justify-between font-bold text-foreground pt-0.5">
                <span>선결제 적용 금액</span>
                <span className="text-primary">0원</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">자릿세는 장바구니에서 수정할 수 있습니다</p>
          </div>

          <button
            onClick={handlePartySizeConfirm}
            className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground font-bold text-base tracking-wider transition-all shadow-lg shadow-primary/30"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // ── Menu screen ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top row: brand + actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1">
                <span
                  className="text-xl font-black text-foreground tracking-wide"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  ADELAND
                </span>
                <span
                  className="text-xs text-primary ml-1"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  ♠ ♥ ♦ ♣
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 bg-card border border-border rounded-full">
                {tableNumber}번 테이블
              </span>
              <span className="px-2 py-0.5 bg-card border border-border rounded-full flex items-center gap-1">
                <Users className="size-3" />
                {partySize}명
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mb-3">
            <Link
              to={"/order-history?table=" + tableNumber}
              className="flex-1"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full border-border text-foreground hover:bg-card hover:border-primary/50"
              >
                <Receipt className="size-4 mr-1.5" />
                결제하기
              </Button>
            </Link>
            <Link
              to={"/cart?table=" + tableNumber}
              className="flex-1"
            >
              <Button
                size="sm"
                className="w-full relative bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <ShoppingCart className="size-4 mr-1.5" />
                장바구니
                {getTotalItems() > 0 && (
                  <Badge className="absolute -top-2 -right-2 size-5 flex items-center justify-center p-0 text-xs bg-amber-500 border-0">
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>

          {/* Category Tabs */}
          <Tabs
            value={selectedCategory}
            onValueChange={setSelectedCategory}
          >
            <TabsList className="w-full bg-card border border-border overflow-x-auto flex">
              {menuCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none text-muted-foreground"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Timer */}
          {endTime !== null &&
            (() => {
              const expired = Date.now() > endTime;
              return (
                <div
                  className={`mt-2.5 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    expired
                      ? "bg-red-950/40 border-red-800/50 text-red-400"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Timer className="size-3.5 shrink-0" />
                    <span>
                      {expired
                        ? "이용 시간이 종료되었습니다"
                        : "이용 종료 시각"}
                    </span>
                    {!expired && (
                      <span className="text-xs opacity-60">
                        · 메인/사이드 추가 주문 시 +30분
                      </span>
                    )}
                  </div>
                  {!expired && (
                    <span
                      className="font-bold text-foreground"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {formatEndTime(endTime)}
                    </span>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Notices */}
      <div className="max-w-4xl mx-auto px-4 pt-3 space-y-2">
        {/* Main dish requirement */}
        <div className="flex items-center gap-3 bg-[#8B1E27] rounded-xl px-4 py-3 shadow-lg shadow-primary/20">
          <AlertCircle className="size-5 shrink-0 text-white/80" />
          <span className="text-white text-sm leading-snug">
            <strong
              className="font-bold text-base block"
              style={{
                fontFamily: "'Playfair Display', serif",
              }}
            >
              2인당 메인 안주 1개 필수
            </strong>
            {partySize >= 2 && (
              <span className="text-white/80 text-xs">
                {partySize}명 기준 최소{" "}
                <strong className="text-white">
                  {Math.ceil(partySize / 2)}개
                </strong>{" "}
                주문해주세요
              </span>
            )}
          </span>
        </div>

        {/* Chip reward notice */}
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 text-sm space-y-1">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            🎰 칩 안내
          </div>
          <div className="flex flex-col gap-0.5 text-amber-300/80 text-xs">
            <span>
              · 메인 안주 1개 주문 시 →{" "}
              <strong className="text-amber-300">칩 2개</strong>{" "}
              지급
            </span>
            <span>
              · 사이드 1개 주문 시 →{" "}
              <strong className="text-amber-300">칩 1개</strong>{" "}
              지급
            </span>
          </div>
          <p className="text-amber-500/70 text-xs pt-0.5">
            칩으로 게임에 도전하고 안주 받아가세요!
          </p>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
