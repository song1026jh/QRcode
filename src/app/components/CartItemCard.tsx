import { Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem } from '../contexts/CartContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  const isChip = item.paymentType === 'chip';
  const isMoney = item.paymentType === 'money';
  const isSeatCharge = item.id === 'seat-charge';

  // Seat charge: editable quantity
  if (isSeatCharge) {
    return (
      <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-muted-foreground">자릿세</h4>
              <p className="text-sm text-muted-foreground mt-0.5">
                {item.price.toLocaleString()}원 × {item.quantity}명
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground mr-2">
                {(item.price * item.quantity).toLocaleString()}원
              </span>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center font-medium text-muted-foreground">{item.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isChip ? 'border-violet-200 bg-violet-50/30' : isMoney ? 'border-blue-200 bg-blue-50/30' : ''}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {item.image && (
            <img
              src={item.image}
              alt={item.nameKo}
              className="w-20 h-20 rounded-md object-cover"
            />
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{item.nameKo}</h4>
                {item.name && (
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                )}
              </div>
              {isChip && (
                <Badge className="bg-violet-500 shrink-0">🎰 칩</Badge>
              )}
              {isMoney && (
                <Badge className="bg-blue-500 shrink-0">💰 현금</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {isChip
                  ? <span className="text-violet-700">{(item.chipPrice ?? 0) * item.quantity}칩</span>
                  : `${item.price.toLocaleString()}원`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
