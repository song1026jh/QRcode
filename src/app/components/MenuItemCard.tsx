import { Plus } from 'lucide-react';
import { MenuItem } from '../data/menu';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem, paymentType?: 'chip' | 'money') => void;
}

export function MenuItemCard({ item, onAddToCart }: MenuItemCardProps) {
  const isGame = item.category === 'game';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <img
          src={item.image}
          alt={item.nameKo}
          className="w-full h-48 object-cover"
        />
        {item.popular && (
          <Badge className="absolute top-2 left-2 bg-red-500">인기</Badge>
        )}
        {isGame && (
          <Badge className="absolute top-2 right-2 bg-violet-600">🎮 게임</Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold text-lg">{item.nameKo}</h3>
            {item.name && (
              <p className="text-sm text-muted-foreground">{item.name}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.description}
          </p>

          {isGame && item.chipPrice !== undefined ? (
            /* Game item: two payment buttons */
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground">결제 방식을 선택하세요</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onAddToCart(item, 'chip')}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-violet-50 border-2 border-violet-200 hover:bg-violet-100 hover:border-violet-400 active:scale-95 transition-all"
                >
                  <span className="text-lg">🎰</span>
                  <span className="font-bold text-violet-700">{item.chipPrice}칩</span>
                  <span className="text-xs text-violet-500">칩 결제</span>
                </button>
                <button
                  onClick={() => onAddToCart(item, 'money')}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-400 active:scale-95 transition-all"
                >
                  <span className="text-lg">💰</span>
                  <span className="font-bold text-blue-700">{item.price.toLocaleString()}원</span>
                  <span className="text-xs text-blue-500">현금 결제</span>
                </button>
              </div>
            </div>
          ) : (
            /* Regular item */
            <div className="flex items-center justify-between pt-2">
              <span className="text-lg font-bold">
                {item.price.toLocaleString()}원
              </span>
              <Button size="sm" onClick={() => onAddToCart(item)}>
                <Plus className="size-4 mr-1" />
                담기
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
