export interface MenuItem {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  price: number;
  category: string;
  image: string;
  popular?: boolean;
  chipPrice?: number;                   // game items: cost in chips
  paymentType?: 'chip' | 'money';      // set when added to cart
  noKitchen?: boolean;                 // skip kitchen, appear directly on server screen
}

export const menuCategories = [
  { id: 'all', name: '전체', nameEn: 'All' },
  { id: 'main', name: '메인 요리', nameEn: 'Main Dishes' },
  { id: 'side', name: '사이드', nameEn: 'Sides' },
  { id: 'basic-snack', name: '기본안주', nameEn: 'Basic Snacks' },
  { id: 'drink', name: '음료', nameEn: 'Drinks' },
  { id: 'game', name: '🎮 게임', nameEn: 'Games' },
];

export const menuItems: MenuItem[] = [
  {
    id: '1',
    name: '',
    nameKo: '콘치즈 불닭볶음면',
    description: '고소한 콘치즈와 화끈한 불닭의 만남',
    price: 18900,
    category: 'main',
    image: 'https://mblogthumb-phinf.pstatic.net/MjAyMzAzMTZfMjA2/MDAxNjc4OTI0NjczMTg4.FVavnQhnk41-til2DpUcX3i80QNmpIMickRH7n0wFLEg.l6RTlN6bQszKwhJ65tBDsUWQ-i8SXC1y9x0oAmT3JVog.JPEG.lkm6770/1678924670178.jpg?type=w800',
    popular: true,
  },
  {
    id: '2',
    name: '',
    nameKo: '치즈오돌뼈',
    description: 'Cheese odolbone:Fantastic taste is ensured',
    price: 19900,
    category: 'main',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQewaCHvCBHty7fUVBLqFM-x8dVTQPBT6OTBC4XxlIYUA&s=10',
    popular: true,
  },
  {
    id: '3',
    name: '',
    nameKo: '오뎅탕',
    description: '소주 한 잔 하기 좋은 뜨끈한 어묵탕',
    price: 17900,
    category: 'main',
    image: 'https://search.pstatic.net/sunny/?src=https%3A%2F%2Fcdn.crowdpic.net%2Fdetail-thumb%2Fthumb_d_1ACC9413843EE8EE356FA343643F7D62.jpg&type=sc960_832',
  },
  {
    id: '4',
    name: '',
    nameKo: '나쵸 & 두가지 소스',
    description: '바삭한 나쵸에 취향대로 즐기는 두 가지 소스',
    price: 10900,
    category: 'side',
    image: 'https://m.dak01.co.kr/web/product/extra/big/202510/7e69fe75828ce0781700ad1afa535535.jpg',
    popular: true,
  },
  {
    id: '5',
    name: '',
    nameKo: '과일화채',
    description: '시원한 밀키스에 상큼한 과일 퐁당',
    price: 11900,
    category: 'side',
    image: 'https://recipe1.ezmember.co.kr/cache/recipe/2018/06/18/dc4c2d6d275c6ccee0566001739492321.jpg',
  },
  {
    id: '6',
    name: '',
    nameKo: '먹태 & 청양마요',
    description: '마른안주 국룰 조합',
    price: 9900,
    category: 'side',
    noKitchen: true,
    image: 'https://semie.cooking/image/contents/recipe/kq/sc/emqywslm/122125717zwkj.jpg',
  },
  {
    id: '7',
    name: '',
    nameKo: '기본안주 추가',
    description: '달콤한 캐러멜 팝콘',
    price: 4000,
    category: 'basic-snack',
    noKitchen: true,
    image: 'https://product-image.kurly.com/hdims/resize/%3E1010x/quality/90/src/product/image/a2e455bc-911b-49a2-a718-a91d0cac4516.jpg',
  },
  {
    id: '8',
    name: '',
    nameKo: '초코에몽',
    description: '',
    price: 3000,
    category: 'drink',
    noKitchen: true,
    image: 'https://img.danawa.com/prod_img/500000/381/608/img/5608381_1.jpg?shrink=360:360&_v=20260405080630',
  },
  {
    id: '9',
    name: '',
    nameKo: '콜라',
    description: '',
    price: 3000,
    category: 'drink',
    noKitchen: true,
    image: 'https://www.etlandmall.co.kr/nas/cdn/attach/product/2025/11/26/B0400173/B0400173_0_600.jpg',
  },
  {
    id: '10',
    name: '',
    nameKo: '사이다',
    description: '',
    price: 3000,
    category: 'drink',
    noKitchen: true,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9Bun3zan8HOkP3rW4wnhrqXpw2xdLi5jIqmCrpGfNQg&s=10',
  },
  {
    id: 'game-1',
    name: '',
    nameKo: '종이뽑기',
    description: '',
    price: 1500,
    chipPrice: 3,
    category: 'game',
    image: 'https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/image_audit/stage/manual/1e2983ac-d5a3-4bda-b188-51f356b7a740_1760330480479.jpeg',
    popular: true,
  },
  {
    id: 'game-2',
    name: '',
    nameKo: '주사위 하이로우',
    description: '',
    price: 2000,
    chipPrice: 4,
    category: 'game',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZFU4IMQMbj8mEczcU6UxMHvTwhdszBWwkwXRfEHEwww&s=10',
  },
  {
    id: 'game-3',
    name: '',
    nameKo: '카드뽑기',
    description: '',
    price: 3500,
    chipPrice: 7,
    category: 'game',
    image: 'https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/595c/b58cb270daf6f931bf559f38c847206cc2b6cc75f469fd37a4437cd723b4.jpg',
  },
];
