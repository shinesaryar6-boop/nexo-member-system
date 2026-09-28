# NEXO Member Token System

ဒီ project က paid membership/token request prototype ဖြစ်ပါတယ်။

Flow:
1. User account ဖွင့်
2. Token 1-10 ရွေး
3. KBZPay/WavePay payment information ထည့်
4. Payment request ကို backend သို့ POST
5. Telegram Bot က Admin ဆီ request ပို့
6. Admin က Approve / Reject
7. Approve ဖြစ်ရင် token ကို 2005 ကနေ 2055 အထိ အစဉ်လိုက် assign
8. User က token ကိုကြည့်နိုင်

## လိုအပ်တာ
- Node.js 18+
- Telegram Bot Token
- Admin Telegram chat ID

## Setup
1. `.env.example` ကို `.env` အဖြစ် copy လုပ်ပါ။
2. `BOT_TOKEN` နဲ့ `ADMIN_CHAT_ID` ထည့်ပါ။
3. `npm install`
4. `npm start`
5. Browser မှာ `http://localhost:3000` ဖွင့်ပါ။

မှတ်ချက်: KBZPay/WavePay ကို API မချိတ်ထားသေးပါ။ User တင်တဲ့ transaction ID ကို Admin က ကိုယ်တိုင်စစ်ပြီး Approve လုပ်ရပါတယ်။
