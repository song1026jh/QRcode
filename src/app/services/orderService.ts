import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  deleteDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { CartItem } from "../contexts/CartContext";

export interface OrderItem {
  id: string;
  name: string;
  nameKo: string;
  price: number;
  quantity: number;
  image: string;
  category?: string;
  noKitchen?: boolean;
  kitchenReady?: number;
  served?: number;
  dealerAdded?: boolean;
  itemPaid?: boolean;
}

export interface Order {
  id?: string;
  tableNumber: string;
  items: OrderItem[];
  totalPrice: number;
  status: "pending" | "preparing" | "completed" | "cancelled";
  paid: boolean;
  timerEnd?: number;
  dealerOrder?: boolean;
  paymentRequests?: {
    game?: number;
    food?: number;
  };
  createdAt: any;
  updatedAt?: any;
}

// 주문 생성
export async function createOrder(
  tableNumber: string,
  items: CartItem[],
  totalPrice: number,
  timerEnd?: number,
) {
  try {
    const orderData: any = {
      tableNumber,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        nameKo: item.nameKo,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category ?? "",
        noKitchen: item.noKitchen ?? false,
        kitchenReady: item.noKitchen ? item.quantity : 0,
        served: 0,
      })),
      totalPrice,
      status: "pending",
      paid: false,
      createdAt: serverTimestamp(),
    };
    if (timerEnd !== undefined) orderData.timerEnd = timerEnd;

    const docRef = await addDoc(
      collection(db, "orders"),
      orderData,
    );
    return { success: true, orderId: docRef.id };
  } catch (error) {
    console.error("Error creating order:", error);
    return { success: false, error };
  }
}

// 주문 상태 업데이트
export async function updateOrderStatus(
  orderId: string,
  status: Order["status"],
) {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { success: false, error };
  }
}

// 아이템 주방 준비 완료 업데이트
export async function updateItemKitchenReady(
  orderId: string,
  itemIndex: number,
  kitchenReady: number,
) {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) return { success: false, error: "Order not found" };

    const items = [...orderDoc.data().items];
    items[itemIndex] = { ...items[itemIndex], kitchenReady };

    await updateDoc(orderRef, {
      items,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating item kitchen ready:", error);
    return { success: false, error };
  }
}

// 아이템 서빙 완료 업데이트
export async function updateItemServed(
  orderId: string,
  itemIndex: number,
  served: number,
) {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) return { success: false, error: "Order not found" };

    const items = [...orderDoc.data().items];
    items[itemIndex] = { ...items[itemIndex], served };

    const allServed = items.every(
      (item: OrderItem) => (item.served ?? 0) >= item.quantity,
    );

    const currentStatus = orderDoc.data().status;
    const updateData: any = { items, updatedAt: serverTimestamp() };
    if (allServed) {
      updateData.status = "completed";
    } else if (currentStatus === "completed" || currentStatus === "pending") {
      updateData.status = "preparing";
    }

    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) {
    console.error("Error updating item served:", error);
    return { success: false, error };
  }
}

// 테이블 인원 수 초기화
export async function resetTablePartySize(tableNumber: string) {
  try {
    await setDoc(doc(db, "tables", tableNumber), { partySize: null }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

// 테이블 인원 수 저장 (Firestore tables 컬렉션)
export async function setTablePartySize(tableNumber: string, partySize: number) {
  try {
    await setDoc(doc(db, "tables", tableNumber), { partySize }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

// 테이블 인원 수 1회 읽기
export async function getTablePartySize(tableNumber: string): Promise<number | null> {
  const snap = await getDoc(doc(db, "tables", tableNumber));
  return snap.data()?.partySize ?? null;
}

// 테이블의 기존 주문에서 메인 안주 총 개수 조회
export async function getTableTimedDishCount(tableNumber: string): Promise<number> {
  const q = query(collection(db, "orders"), where("tableNumber", "==", tableNumber));
  const snap = await getDocs(q);
  let count = 0;
  snap.forEach((d) => {
    const items: any[] = d.data().items ?? [];
    items.forEach((item) => {
      if (item.category === "main" || item.category === "side") {
        count += item.quantity ?? 1;
      }
    });
  });
  return count;
}

// 테이블 인원 수 실시간 구독
export function subscribeToTablePartySize(
  tableNumber: string,
  callback: (partySize: number | null) => void,
) {
  return onSnapshot(doc(db, "tables", tableNumber), (snap) => {
    const data = snap.data();
    callback(data?.partySize ?? null);
  });
}

// 게임 완료 처리 (kitchenReady + served 동시 설정)
export async function markGameComplete(
  orderId: string,
  itemIndex: number,
  quantity: number,
) {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) return { success: false, error: "Order not found" };

    const items = [...orderDoc.data().items];
    items[itemIndex] = { ...items[itemIndex], kitchenReady: quantity, served: quantity, itemPaid: true };

    const allServed = items.every(
      (item: OrderItem) => (item.served ?? 0) >= item.quantity,
    );

    await updateDoc(orderRef, {
      items,
      status: allServed ? "completed" : "preparing",
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error completing game:", error);
    return { success: false, error };
  }
}

// 게임 완료 되돌리기
export async function undoGameComplete(orderId: string, itemIndex: number) {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) return { success: false };

    const items = [...orderDoc.data().items];
    items[itemIndex] = { ...items[itemIndex], kitchenReady: 0, served: 0, itemPaid: false };

    await updateDoc(orderRef, {
      items,
      status: "preparing",
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error undoing game complete:", error);
    return { success: false, error };
  }
}

// 딜러 추가 주문 취소 (주문 문서 삭제)
export async function cancelDealerOrder(orderId: string) {
  try {
    await deleteDoc(doc(db, "orders", orderId));
    return { success: true };
  } catch (error) {
    console.error("Error cancelling dealer order:", error);
    return { success: false, error };
  }
}

// 딜러가 무료로 메뉴 추가
export async function createDealerOrder(
  tableNumber: string,
  items: Array<{
    id: string;
    name: string;
    nameKo: string;
    image: string;
    noKitchen: boolean;
    quantity: number;
  }>,
) {
  try {
    const orderData = {
      tableNumber,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        nameKo: item.nameKo,
        price: 0,
        quantity: item.quantity,
        image: item.image,
        noKitchen: item.noKitchen,
        kitchenReady: item.noKitchen ? item.quantity : 0,
        served: 0,
        dealerAdded: true,
      })),
      totalPrice: 0,
      status: "pending",
      paid: false,
      dealerOrder: true,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);
    return { success: true, orderId: docRef.id };
  } catch (error) {
    console.error("Error creating dealer order:", error);
    return { success: false, error };
  }
}

// 실시간 주문 목록 구독
export function subscribeToOrders(
  callback: (orders: Order[]) => void,
) {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() } as Order);
    });
    callback(orders);
  });
}

// 특정 테이블의 주문 목록 구독
export function subscribeToTableOrders(
  tableNumber: string,
  callback: (orders: Order[]) => void,
) {
  const q = query(
    collection(db, "orders"),
    where("tableNumber", "==", tableNumber),
  );

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() } as Order);
    });
    orders.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    callback(orders);
  });
}

// 테이블 결제 완료 처리
export async function markTableAsPaid(tableNumber: string) {
  try {
    const q = query(
      collection(db, "orders"),
      where("tableNumber", "==", tableNumber),
      where("paid", "==", false),
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map((document) =>
      updateDoc(doc(db, "orders", document.id), {
        paid: true,
        updatedAt: serverTimestamp(),
      }),
    );

    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    console.error("Error marking table as paid:", error);
    return { success: false, error };
  }
}

export type PaymentRequestType = "game" | "food";

// Stores the staff call on the affected orders so the dealer and server views
// can react to it in real time.
export async function requestPayment(
  tableNumber: string,
  paymentType: PaymentRequestType,
) {
  try {
    const q = query(
      collection(db, "orders"),
      where("tableNumber", "==", tableNumber),
      where("paid", "==", false),
    );
    const snapshot = await getDocs(q);
    const requestedAt = Date.now();

    const updates = snapshot.docs
      .filter((document) => {
        const items: OrderItem[] = document.data().items ?? [];
        return items.some((item) => {
          const isGame = item.id.startsWith("game-");
          return paymentType === "game" ? isGame : !isGame;
        });
      })
      .map((document) =>
        updateDoc(doc(db, "orders", document.id), {
          [`paymentRequests.${paymentType}`]: requestedAt,
          updatedAt: serverTimestamp(),
        }),
      );

    await Promise.all(updates);
    return { success: true };
  } catch (error) {
    console.error("Error requesting payment:", error);
    return { success: false, error };
  }
}

// 테이블 주문 내역 초기화 (결제 완료된 주문만 삭제 + 인원 수 리셋)
export async function clearTableOrders(tableNumber: string) {
  try {
    const q = query(
      collection(db, "orders"),
      where("tableNumber", "==", tableNumber),
    );

    const snapshot = await getDocs(q);

    // order.paid === true 이거나, 모든 아이템이 itemPaid === true인 주문 삭제
    const effectivelyPaid = snapshot.docs.filter((document) => {
      const data = document.data();
      if (data.paid === true) return true;
      const items: any[] = data.items ?? [];
      return items.length > 0 && items.every((item) => item.itemPaid === true);
    });

    const deletePromises = effectivelyPaid.map((document) =>
      deleteDoc(doc(db, "orders", document.id)),
    );

    await Promise.all([
      ...deletePromises,
      setDoc(doc(db, "tables", tableNumber), { partySize: null }, { merge: true }),
    ]);
    return { success: true };
  } catch (error) {
    console.error("Error clearing table orders:", error);
    return { success: false, error };
  }
}
