import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RuleRow = {
  name: string;
  amount: string;
  amountType: 'discount' | 'fee';
  conditions: string[];
  note?: string;
};

const RULES: RuleRow[] = [
  {
    name: '校內生優惠（7月）',
    amount: '-3,000',
    amountType: 'discount',
    conditions: ['身份：校內生', '報名：7月夏令營全日基本課程'],
  },
  {
    name: '校內生優惠（8月）',
    amount: '-3,000',
    amountType: 'discount',
    conditions: ['身份：校內生', '報名：8月夏令營全日基本課程'],
  },
  {
    name: '7月營隊組合優惠',
    amount: '兩營合計 6,400',
    amountType: 'discount',
    conditions: [
      '身份：校內生',
      '報名：7月夏令營全日基本課程',
      '報名：化石生態營',
      '報名：玩具製作營',
    ],
  },
  {
    name: '8月營隊組合優惠',
    amount: '兩營合計 7,000',
    amountType: 'discount',
    conditions: [
      '身份：校內生',
      '報名：8月夏令營全日基本課程',
      '報名：美學手作營',
      '報名：自然電路營',
    ],
  },
  {
    name: '7月戶外教學全報優惠',
    amount: '-300',
    amountType: 'discount',
    conditions: [
      '報名：7/10｜戶外教學',
      '報名：7/17｜戶外教學',
      '報名：7/31｜戶外教學',
    ],
    note: '三個全報才享有優惠（7/23、24 兩天一夜不計入）',
  },
  {
    name: '8月戶外教學全報優惠',
    amount: '-300',
    amountType: 'discount',
    conditions: [
      '報名：8/7｜戶外教學',
      '報名：8/14｜戶外教學',
      '報名：8/21｜戶外教學',
    ],
    note: '三個全報才享有優惠',
  },
  {
    name: '真人口說特惠',
    amount: '-800',
    amountType: 'discount',
    conditions: [
      '報名：真人口說密集特訓',
      '報名：任一全日基本課程（7月或8月）',
      '報名：至少一個營隊',
    ],
  },
  {
    name: 'YLE 教材費',
    amount: '+2,000',
    amountType: 'fee',
    conditions: ['報名：YLE英檢實力班'],
    note: '7月、8月同時報名，教材費只收一次（計入較早月份帳單）',
  },
];

export default function DiscountRulesPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground">
          ← 帳單管理
        </Link>
        <h1 className="text-2xl font-bold mt-1">折扣與費用規則</h1>
        <p className="text-sm text-muted-foreground mt-1">系統開帳時自動套用，所有條件須同時符合才會觸發</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2026 暑假計費規則</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">名稱</TableHead>
                <TableHead className="w-36">金額</TableHead>
                <TableHead>適用條件</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RULES.map((rule) => (
                <TableRow key={rule.name}>
                  <TableCell className="font-medium text-sm align-top pt-4">
                    {rule.name}
                  </TableCell>
                  <TableCell className="align-top pt-4">
                    <Badge variant={rule.amountType === 'discount' ? 'default' : 'destructive'}>
                      {rule.amount}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top pt-3">
                    <ul className="space-y-1">
                      {rule.conditions.map((c) => (
                        <li key={c} className="text-sm flex items-start gap-1.5">
                          <span className="text-muted-foreground mt-0.5">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                    {rule.note && (
                      <p className="text-xs text-muted-foreground mt-2 pl-3.5">{rule.note}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
