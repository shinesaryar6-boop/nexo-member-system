require("dotenv").config();
const express=require("express");
const path=require("path");
const Database=require("better-sqlite3");
const {Telegraf,Markup}=require("telegraf");

const app=express();
const db=new Database("nexo.db");
const bot=new Telegraf(process.env.BOT_TOKEN);

const START=2005, END=2055, PRICE=5000, MAX_QTY=10;

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL,
 login_type TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 qty INTEGER NOT NULL,
 amount INTEGER NOT NULL,
 sender TEXT NOT NULL,
 trx TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING',
 tokens TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings(
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key,value) VALUES('next_token','2005');
`);

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

function nextToken(qty){
  const row=db.prepare("SELECT value FROM settings WHERE key='next_token'").get();
  const start=Number(row.value), end=start+qty-1;
  if(end>END) return null;
  const tokens=Array.from({length:qty},(_,i)=>start+i);
  db.prepare("UPDATE settings SET value=? WHERE key='next_token'").run(String(end+1));
  return tokens;
}

function adminOnly(ctx){
  return String(ctx.chat?.id)===String(process.env.ADMIN_CHAT_ID);
}

app.post("/api/register",(req,res)=>{
  const {username,loginType}=req.body||{};
  if(!username || !["Telegram","TikTok"].includes(loginType))
    return res.status(400).json({error:"Invalid account"});
  const info=db.prepare("INSERT INTO users(username,login_type) VALUES(?,?)")
    .run(username.trim(),loginType);
  res.json({userId:info.lastInsertRowid});
});

app.post("/api/payment-request",async(req,res)=>{
  try{
    const {userId,qty,sender,trx}=req.body||{};
    if(!userId||!Number.isInteger(qty)||qty<1||qty>MAX_QTY||!sender||!trx)
      return res.status(400).json({error:"Invalid request"});
    const user=db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    if(!user) return res.status(404).json({error:"User not found"});

    const amount=qty*PRICE;
    const info=db.prepare(`
      INSERT INTO requests(user_id,qty,amount,sender,trx)
      VALUES(?,?,?,?,?)
    `).run(userId,qty,amount,sender.trim(),trx.trim());

    const requestId=info.lastInsertRowid;
    const text=
`🔔 NEXO Payment Request #${requestId}

👤 User: ${user.username}
🔗 Login: ${user.login_type}
🎟 Token: ${qty}
💰 Amount: ${amount.toLocaleString()} MMK
👨 Sender: ${sender}
🧾 Transaction ID: ${trx}

စစ်ဆေးပြီး Approve / Reject လုပ်ပါ။`;

    await bot.telegram.sendMessage(
      process.env.ADMIN_CHAT_ID,
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Approve","approve:"+requestId),
         Markup.button.callback("❌ Reject","reject:"+requestId)]
      ])
    );
    res.json({ok:true,requestId});
  }catch(e){
    console.error(e);
    res.status(500).json({error:"Server error"});
  }
});

app.get("/api/requests/:id",(req,res)=>{
  const r=db.prepare(`
    SELECT r.*,u.username,u.login_type
    FROM requests r JOIN users u ON u.id=r.user_id
    WHERE r.id=?
  `).get(req.params.id);
  if(!r)return res.status(404).json({error:"Not found"});
  res.json(r);
});

bot.action(/^approve:(\d+)$/,async ctx=>{
  if(!adminOnly(ctx)) return ctx.answerCbQuery("Not authorized");
  const id=Number(ctx.match[1]);
  const r=db.prepare("SELECT * FROM requests WHERE id=?").get(id);
  if(!r || r.status!=="PENDING") return ctx.answerCbQuery("Already processed");

  const tokens=nextToken(r.qty);
  if(!tokens){
    await ctx.answerCbQuery("Token 2055 reached");
    return ctx.reply(`❌ Request #${id}: Token stock မရှိတော့ပါ (2055 ထိပြည့်ပြီးပါပြီ)`);
  }

  db.prepare("UPDATE requests SET status='APPROVED',tokens=? WHERE id=?")
    .run(tokens.join(","),id);

  await ctx.answerCbQuery("Approved");
  await ctx.editMessageReplyMarkup({inline_keyboard:[]});
  await ctx.reply(
`✅ Approved #${id}
User: ${r.user_id}
Tokens: ${tokens.join(", ")}
Amount: ${r.amount.toLocaleString()} MMK`
  );
});

bot.action(/^reject:(\d+)$/,async ctx=>{
  if(!adminOnly(ctx)) return ctx.answerCbQuery("Not authorized");
  const id=Number(ctx.match[1]);
  const r=db.prepare("SELECT * FROM requests WHERE id=?").get(id);
  if(!r || r.status!=="PENDING") return ctx.answerCbQuery("Already processed");
  db.prepare("UPDATE requests SET status='REJECTED' WHERE id=?").run(id);
  await ctx.answerCbQuery("Rejected");
  await ctx.editMessageReplyMarkup({inline_keyboard:[]});
  await ctx.reply(`❌ Payment Request #${id} rejected.`);
});

bot.catch(err=>console.error("Telegram error",err));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`NEXO running on http://localhost:${PORT}`));

if(process.env.BOT_TOKEN){
  bot.launch().then(()=>console.log("Telegram bot started"));
}else{
  console.log("BOT_TOKEN is missing. Web server still runs.");
}
process.once("SIGINT",()=>bot.stop("SIGINT"));
process.once("SIGTERM",()=>bot.stop("SIGTERM"));
