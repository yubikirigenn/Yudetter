import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function TermsPage() {
  return (
    <div className="w-full min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold font-rounded">利用規約</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 flex flex-col gap-6">
        <div className="border border-border/60 bg-secondary/5 rounded-3xl p-6 flex flex-col gap-3">
          <p className="text-sm text-foreground/80 leading-relaxed">
            この利用規約（以下、「本規約」といいます。）は、Yudetter（以下、「当サービス」といいます。）が提供するサービス（以下、「本サービス」といいます。）の利用条件を定めるものです。登録会員の皆さま（以下、「会員」といいます。）には、本規約に従って本サービスをご利用いただきます。
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full flex flex-col gap-3">
          <AccordionItem value="item-1" className="border border-border/60 rounded-2xl px-4 bg-card shadow-sm">
            <AccordionTrigger className="font-rounded font-bold text-sm hover:no-underline">
              第1章 総則
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3.5 pt-2 pb-4">
              <div>
                <h4 className="font-bold text-foreground mb-1">第1条（適用）</h4>
                <p>本規約は、会員と当サービスとの間の本サービスの利用に関わる一切の関係に適用されるものとします。</p>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第2条（規約の変更）</h4>
                <p>当サービスは、必要と判断した場合には、会員に通知することなくいつでも本規約を変更することができるものとします。変更後の利用規約は、本サービス上に表示された時点から効力を生じるものとします。</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border border-border/60 rounded-2xl px-4 bg-card shadow-sm">
            <AccordionTrigger className="font-rounded font-bold text-sm hover:no-underline">
              第2章 アカウント登録
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3.5 pt-2 pb-4">
              <div>
                <h4 className="font-bold text-foreground mb-1">第3条（利用登録）</h4>
                <p>登録希望者が本規約に同意の上、当サービスの定める方法によって利用登録を申請し、当サービスがこれを承認することによって、利用登録が完了するものとします。登録にあたりGoogleアカウントまたはメールアドレスが必要となります。</p>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第4条（ユーザーIDとパスワードの管理）</h4>
                <p>会員は、自己の責任において、本サービスのアカウントおよびパスワード等の認証情報を適切に管理するものとします。いかなる場合にも、これらを第三者に譲渡または貸与することはできません。</p>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第5条（利用制限および登録抹消）</h4>
                <p>当サービスは、会員が本規約のいずれかの条項に違反した場合、または不正な利用が認められた場合、事前通知なしに本サービスの利用を制限、またはアカウントの登録を抹消できるものとします。</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-border/60 rounded-2xl px-4 bg-card shadow-sm">
            <AccordionTrigger className="font-rounded font-bold text-sm hover:no-underline">
              第3章 ユデドル（YD）とマーケット取引規約
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3.5 pt-2 pb-4">
              <div>
                <h4 className="font-bold text-foreground mb-1">第6条（ユデドル (YD) の定義と付与・削減）</h4>
                <p>ユデドル（以下「YD」）は、当サービス内でのマーケット購入等に利用できるポイントです。新規登録時にウェルカムボーナスとして 1,000 YD が付与されます。新規の親投稿（ユデート）を作成した際に 5 YD が付与され、親投稿を削除した場合はペナルティとして 5 YD が残高から減算されます。なお、返信（リプライ）の作成・削除時はYDの付与および減算ペナルティの対象外とします。</p>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第7条（マーケットでの出品と販売）</h4>
                <p>会員は、自身の作成したデジタルコンテンツ（画像、音声、ゲーム等）をマーケットに出品できます。出品時のルールは以下の通りとします：</p>
                <ul className="list-disc list-inside mt-1 pl-2 flex flex-col gap-1">
                  <li><strong>通常商品 (画像・音声等)</strong>: 通常販売（即時購入）またはオークション形式を選択できます。通常販売時、数量は 1 〜 99 個、または「無限」を選択して販売可能です。</li>
                  <li><strong>ゲーム商品</strong>: 作成したゲームを出品する場合、販売形式は通常販売（固定価格）に固定され、オークション形式は指定できません。また、数量は「無限」に固定されます。</li>
                  <li><strong>ユーザーIDの出品</strong>: 会員は自身の現在のユーザーIDを出品できます。購入または落札が成立した時点で、出品者のIDはランダムな仮IDに変更され、元のIDの所有権は購入者に自動移転します。</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第8条（スーパーユデート（投げ銭））</h4>
                <p>会員は、親投稿に対する返信（リプライ）を送信する際、1 YD 〜 100,000 YD の範囲で金額を設定して「スーパーユデート」を添付できます。スーパーユデートが添付された返信は、タイムラインの返信一覧において、金額が高い順に最上部エリアに優先固定表示されます。自分自身への返信、および返信に対する返信（孫リプライ）にはスーパーユデートを設定できません。</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border border-border/60 rounded-2xl px-4 bg-card shadow-sm">
            <AccordionTrigger className="font-rounded font-bold text-sm hover:no-underline">
              第4章 禁止事項
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3.5 pt-2 pb-4">
              <div>
                <h4 className="font-bold text-foreground mb-1">第9条（禁止行為）</h4>
                <p>本サービスの利用にあたり、会員は以下の行為を行ってはならないものとします：</p>
                <ul className="list-disc list-inside mt-1 pl-2 flex flex-col gap-1">
                  <li>法令または公序良俗に違反する行為、犯罪行為に関連する行為</li>
                  <li>他の会員に対する嫌がらせ、ストーカー、または脅迫行為</li>
                  <li>当サービスまたは第三者の知的財産権（著作権、商標権等）を侵害する行為</li>
                  <li>他人のアカウントを不正に使用する行為、他者へのなりすまし行為</li>
                  <li>本サービスのサーバーやネットワークの機能を破壊、または妨害する行為</li>
                  <li>虚偽のデータや、悪意あるプログラムをアップロード・送信する行為</li>
                  <li>当サービス内でのマネーロンダリングを目的とした取引行為</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border border-border/60 rounded-2xl px-4 bg-card shadow-sm">
            <AccordionTrigger className="font-rounded font-bold text-sm hover:no-underline">
              第5章 免責事項・雑則
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3.5 pt-2 pb-4">
              <div>
                <h4 className="font-bold text-foreground mb-1">第10条（免責事項）</h4>
                <p>当サービスは、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。当サービスは、本サービスに関して会員に生じたあらゆる損害について、当サービスの故意または重大な過失による場合を除き、一切の責任を负いません。</p>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">第11条（準拠法・裁判管轄）</h4>
                <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当サービスの本店所在地を管轄する地方裁判所を専属的合意管轄とします。</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
