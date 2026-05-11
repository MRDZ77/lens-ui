import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "https://lens-api-qu0x.onrender.com/api/prices";

const VOLATILITY: Record<string, number> = { USD: 0.018, EUR: 0.022, XAU: 0.028, MXN: 0.065, ETH: 0.110, BTC: 0.095 };
const STRENGTH: Record<string, number>   = { USD: 0.95,  EUR: 0.90,  XAU: 0.85,  MXN: 0.40,  BTC: 0.55,  ETH: 0.45  };

interface Currency {
  id: string;
  label: string;
  flag?: string;
  symbol?: string;
  name: string;
  color?: string;
}

const CURRENCIES: Currency[] = [
  { id: "MXN", label: "MXN", flag: "🇲🇽", name: "Peso Mexicano" },
  { id: "USD", label: "USD", flag: "🇺🇸", name: "Dolar" },
  { id: "EUR", label: "EUR", flag: "🇪🇺", name: "Euro" },
  { id: "BTC", label: "BTC", symbol: "₿", name: "Bitcoin",  color: "#F7931A" },
  { id: "ETH", label: "ETH", symbol: "Ξ", name: "Ethereum", color: "#627EEA" },
  { id: "XAU", label: "XAU", symbol: "◈", name: "Oro",      color: "#C9A84C" },
];

const PERIODS = ["1D", "1S", "1M", "1A", "TODO"];

const DEFAULT_RATES: Record<string, number> = { MXN: 17.21, USD: 1, EUR: 0.849, BTC: 81351, ETH: 2357, XAU: 2320 };

function buildRates(data: any): Record<string, number> {
  return {
    USD: 1,
    MXN: data?.exchangeRates?.MXN?.usdRate ?? DEFAULT_RATES.MXN,
    EUR: data?.exchangeRates?.EUR?.usdRate ?? DEFAULT_RATES.EUR,
    BTC: data?.prices?.BTC?.usd           ?? DEFAULT_RATES.BTC,
    ETH: data?.prices?.ETH?.usd           ?? DEFAULT_RATES.ETH,
    XAU: data?.prices?.XAU?.usd           ?? DEFAULT_RATES.XAU,
  };
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const usd = from === "USD" ? amount : amount / rates[from];
  return to === "USD" ? usd : usd * rates[to];
}

function fmt(v: number, id: string): string {
  if (id === "BTC") return "₿ " + v.toFixed(6);
  if (id === "ETH") return "Ξ " + v.toFixed(4);
  if (id === "XAU") return "◈ " + v.toFixed(4) + " oz";
  if (id === "USD") return "$ " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (id === "EUR") return "€ " + v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$ " + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface WaveData {
  top: number[];
  bot: number[];
  topBias: number;
  botBias: number;
  topAmp: number;
  botAmp: number;
}

function generateWave(points: number, amplitude: number, bias: number): number[] {
  const data: number[] = [];
  let val = bias;
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5) * amplitude * 0.03;
    val += (bias - val) * 0.04;
    val = Math.max(bias - amplitude * 0.35, Math.min(bias + amplitude, val));
    data.push(val);
  }
  return data;
}

function computeParams(topId: string, botId: string) {
  const sTop = STRENGTH[topId] ?? 0.5;
  const sBot = STRENGTH[botId] ?? 0.5;
  const total = sTop + sBot;
  return {
    topBias: (sBot / total) * 0.075,
    botBias: -(sTop / total) * 0.075,
    topAmp: VOLATILITY[topId] ?? 0.05,
    botAmp: VOLATILITY[botId] ?? 0.05,
  };
}

function TensionChart({ topCurrency, bottomCurrency }: { topCurrency: Currency; bottomCurrency: Currency }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef   = useRef<WaveData | null>(null);
  const frameRef  = useRef(0);
  const animRef   = useRef<number | null>(null);
  const hoverRef  = useRef<{ x: number; index: number } | null>(null);
  const transRef  = useRef<{ active: boolean; from?: WaveData; to?: WaveData; alpha?: number }>({ active: false });

  const initData = useCallback((topId: string, botId: string): WaveData => {
    const p = computeParams(topId, botId);
    return {
      ...p,
      top: generateWave(140, p.topAmp, p.topBias),
      bot: generateWave(140, p.botAmp, p.botBias),
    };
  }, []);

  useEffect(() => {
    const next = initData(topCurrency.id, bottomCurrency.id);
    if (!dataRef.current) { dataRef.current = next; return; }
    const from = dataRef.current;
    transRef.current = { active: true, from, to: next, alpha: 0 };
    const dur = 700;
    const start = performance.now();
    function fade(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      transRef.current.alpha = ease;
      if (t < 1) requestAnimationFrame(fade);
      else { dataRef.current = next; transRef.current = { active: false }; }
    }
    requestAnimationFrame(fade);
  }, [topCurrency.id, bottomCurrency.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    if (!dataRef.current) dataRef.current = initData(topCurrency.id, bottomCurrency.id);

    function evolve(d: WaveData) {
      d.top.shift();
      let t = d.top[d.top.length - 1];
      t += (Math.random() - 0.5) * d.topAmp * 0.03;
      t += (d.topBias - t) * 0.04;
      t = Math.max(d.topBias - d.topAmp * 0.35, Math.min(d.topBias + d.topAmp, t));
      d.top.push(t);
      d.bot.shift();
      let b = d.bot[d.bot.length - 1];
      b += (Math.random() - 0.5) * d.botAmp * 0.03;
      b += (d.botBias - b) * 0.04;
      b = Math.max(d.botBias - d.botAmp, Math.min(d.botBias + d.botAmp * 0.35, b));
      d.bot.push(b);
    }

    function drawScene(ctx: CanvasRenderingContext2D, cW: number, cH: number, d: WaveData, alpha: number) {
      const n = d.top.length;
      const mid = cH / 2;
      const sc  = cH * 3.0;
      const toX = (i: number) => (i / (n - 1)) * cW;
      const toY = (v: number) => mid - v * sc;
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.038)";
      ctx.lineWidth = 0.5;
      for (let c = 1; c < 6; c++) {
        ctx.beginPath(); ctx.moveTo((c/6)*cW, 0); ctx.lineTo((c/6)*cW, cH); ctx.stroke();
      }
      for (let r = 1; r < 4; r++) {
        ctx.beginPath(); ctx.moveTo(0, (r/4)*cH); ctx.lineTo(cW, (r/4)*cH); ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.75;
      ctx.setLineDash([3, 11]);
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(cW, mid); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const gTop = ctx.createLinearGradient(0, 0, 0, mid);
      gTop.addColorStop(0, "rgba(139,124,255,0.20)");
      gTop.addColorStop(1, "rgba(139,124,255,0.00)");
      ctx.beginPath();
      ctx.moveTo(toX(0), mid);
      for (let i = 0; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.lineTo(toX(n-1), mid);
      ctx.closePath();
      ctx.fillStyle = gTop; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.top[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.strokeStyle = "rgba(139,124,255,0.88)";
      ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();

      const gBot = ctx.createLinearGradient(0, mid, 0, cH);
      gBot.addColorStop(0, "rgba(137,175,255,0.00)");
      gBot.addColorStop(1, "rgba(137,175,255,0.20)");
      ctx.beginPath();
      ctx.moveTo(toX(0), mid);
      for (let j = 0; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.lineTo(toX(n-1), mid);
      ctx.closePath();
      ctx.fillStyle = gBot; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.bot[0]));
      for (let j = 1; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.strokeStyle = "rgba(137,175,255,0.75)";
      ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();

      const pulse = (Math.sin(frameRef.current * 0.07) + 1) / 2;
      const lx = toX(n-1);
      const ly = toY(d.top[n-1]);
      ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(139,124,255,1)"; ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, 6 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,124,255,${(0.14 - pulse * 0.11).toFixed(3)})`; ctx.fill();

      if (hoverRef.current) {
        const hx = hoverRef.current.x;
        const hi = hoverRef.current.index;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 0.75; ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, cH); ctx.stroke();
        ctx.setLineDash([]);
        const ty = toY(d.top[hi]);
        ctx.beginPath(); ctx.arc(hx, ty, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(139,124,255,0.9)"; ctx.fill();
        const by = toY(d.bot[hi]);
        ctx.beginPath(); ctx.arc(hx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(137,175,255,0.8)"; ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      frameRef.current++;
      const c = canvasRef.current; if (!c) return;
      const cW = c.width / dpr; const cH = c.height / dpr;
      ctx.clearRect(0, 0, cW, cH);
      if (transRef.current.active && transRef.current.from && transRef.current.to && transRef.current.alpha !== undefined) {
        drawScene(ctx, cW, cH, transRef.current.from, 1 - transRef.current.alpha);
        drawScene(ctx, cW, cH, transRef.current.to,   transRef.current.alpha);
      } else if (dataRef.current) {
        if (frameRef.current % 2 === 0) evolve(dataRef.current);
        drawScene(ctx, cW, cH, dataRef.current, 1);
      }
      animRef.current = requestAnimationFrame(tick);
    }
    tick();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [topCurrency.id, bottomCurrency.id]);

  function onMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const c = canvasRef.current; if (!c || !dataRef.current) return;
    const rect = c.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = cx - rect.left;
    const n = dataRef.current.top.length;
    const index = Math.max(0, Math.min(n - 1, Math.round((x / rect.width) * (n - 1))));
    hoverRef.current = { x, index };
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={onMove}
      onMouseLeave={() => { hoverRef.current = null; }}
      onTouchMove={onMove}
      onTouchEnd={() => { hoverRef.current = null; }}
      style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
    />
  );
}

function LensIcon({ size = 32, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `1.5px solid rgba(255,255,255,${pulse ? 0.7 : 0.45})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: pulse ? "lensGlow 3.5s ease-in-out infinite" : "none",
      flexShrink: 0,
    }}>
      <div style={{ width: size * 0.52, height: size * 0.52, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.13)" }} />
    </div>
  );
}

function CurrencyPill({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20, padding: "5px 10px", cursor: "pointer", color: "#fff",
      fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
    }}>
      {currency.symbol
        ? <span style={{ color: currency.color || "#fff", fontSize: 13 }}>{currency.symbol}</span>
        : <span style={{ fontSize: 14 }}>{currency.flag}</span>}
      <span style={{ opacity: 0.75 }}>{currency.label}</span>
      <span style={{ opacity: 0.22, fontSize: 9 }}>v</span>
    </button>
  );
}

function CurrencyBar({ currencies, selected, onSelect }: { currencies: Currency[]; selected: Currency; onSelect: (c: Currency) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
      {currencies.map((c) => {
        const active = c.id === selected.id;
        return (
          <button key={c.id} onClick={() => onSelect(c)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: active ? "rgba(139,124,255,0.12)" : "transparent",
            border: active ? "1px solid rgba(139,124,255,0.32)" : "1px solid rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "6px 4px", cursor: "pointer", minWidth: 40,
            transition: "all 0.18s",
          }}>
            <span style={{ fontSize: 16 }}>
              {c.symbol ? <span style={{ color: c.color || "#fff", fontSize: 14 }}>{c.symbol}</span> : c.flag}
            </span>
            <span style={{
              fontFamily: "monospace", fontSize: 7.5,
              color: active ? "rgba(139,124,255,0.85)" : "rgba(255,255,255,0.32)",
              letterSpacing: "0.06em",
            }}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CurrencySelector({ which, onSelect, onCancel }: { which: string; onSelect: (c: Currency) => void; onCancel: () => void }) {
  return (
    <div style={{ background: "#070707", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <div style={{ width: 300 }}>
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 8.5, letterSpacing: "0.2em", marginBottom: 20, textAlign: "center", textTransform: "uppercase" }}>
          referencia {which === "top" ? "superior" : "inferior"}
        </p>
        {CURRENCIES.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)} style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%",
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 12, padding: "13px 16px", marginBottom: 7, cursor: "pointer", color: "#fff",
            fontFamily: "monospace",
          }}>
            <span style={{ fontSize: 20 }}>
              {c.symbol ? <span style={{ color: c.color || "#fff" }}>{c.symbol}</span> : c.flag}
            </span>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.09em" }}>{c.label}</div>
              <div style={{ fontSize: 8.5, opacity: 0.28, marginTop: 2 }}>{c.name}</div>
            </div>
          </button>
        ))}
        <button onClick={onCancel} style={{ marginTop: 10, width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.14)", fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.12em", cursor: "pointer", padding: "10px" }}>cancelar</button>
      </div>
    </div>
  );
}

function GlobalStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #070707; }
      @keyframes lensGlow {
        0%,100% { box-shadow:0 0 0 0 rgba(139,124,255,0); }
        50% { box-shadow:0 0 14px 2px rgba(139,124,255,0.18); }
      }
      @keyframes breathe {
        0%,100% { opacity:0.55; }
        50% { opacity:1; }
      }
    `}} />
  );
}

export default function LensApp() {
  const [topCurrency, setTopCurrency]       = useState<Currency>(CURRENCIES[0]);
  const [bottomCurrency, setBottomCurrency] = useState<Currency>(CURRENCIES[1]);
  const [expanded, setExpanded]             = useState(false);
  const [period, setPeriod]                 = useState("1D");
  const [mounted, setMounted]               = useState(false);
  const [selectingFor, setSelectingFor]     = useState<string | null>(null);
  const [rates, setRates]                   = useState<Record<string, number>>(DEFAULT_RATES);
  const [live, setLive]                     = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
    function fetchPrices() {
      fetch(API_URL)
        .then((r) => r.json())
        .then((data) => { setRates(buildRates(data)); setLive(true); })
        .catch((e) => { console.error("API error", e); });
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const bottomValue  = convert(20000, topCurrency.id, bottomCurrency.id, rates);
  const bottomAmount = fmt(bottomValue, bottomCurrency.id);

  function swap() {
    const tmp = topCurrency;
    setTopCurrency(bottomCurrency);
    setBottomCurrency(tmp);
  }

  function onTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy > 35)  setExpanded(true);
    if (dy < -35) setExpanded(false);
    touchStartY.current = null;
  }

  if (selectingFor) {
    return (
      <div>
        <GlobalStyles />
        <CurrencySelector
          which={selectingFor}
          onSelect={(c) => {
            if (selectingFor === "top") setTopCurrency(c); else setBottomCurrency(c);
            setSelectingFor(null);
          }}
          onCancel={() => setSelectingFor(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <GlobalStyles />
      <div
        style={{ background: "#070707", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{
          width: 320, height: 695, background: "#090909", borderRadius: 46,
          border: "1px solid rgba(255,255,255,0.065)",
          boxShadow: "0 50px 130px rgba(0,0,0,0.88), inset 0 0 0 1px rgba(255,255,255,0.032)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.9s ease, transform 0.9s ease",
        }}>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 22px 0", fontSize: 10, color: "rgba(255,255,255,0.38)", letterSpacing: "0.04em" }}>
            <span>9:41</span><span>*** ***</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 8px" }}>
            <LensIcon size={28} pulse={true} />
            <span style={{ fontFamily: "sans-serif", fontWeight: 200, fontSize: 17, letterSpacing: "0.38em", color: "rgba(255,255,255,0.82)" }}>l e n s</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: live ? "#4ade80" : "#666", animation: live ? "breathe 2.5s ease-in-out infinite" : "none" }} />
              <span style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(255,255,255,0.22)" }}>{live ? "LIVE" : "..."}</span>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!expanded && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 54, fontFamily: "sans-serif", fontWeight: 200, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>
                    {topCurrency.symbol || ""}{(20000).toLocaleString("es-MX")}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <CurrencyPill currency={topCurrency} onClick={() => setSelectingFor("top")} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 8, letterSpacing: "0.18em", color: "rgba(255,255,255,0.17)" }}>{topCurrency.name.toUpperCase()}</div>
                </div>

                <button onClick={swap} style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "rgba(139,124,255,0.09)", border: "1px solid rgba(139,124,255,0.27)",
                  cursor: "pointer", color: "rgba(139,124,255,0.82)", fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0",
                }}>⇅</button>

                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 44, fontFamily: "sans-serif", fontWeight: 200, color: "rgba(255,255,255,0.62)", letterSpacing: "-0.01em", lineHeight: 1 }}>
                    {bottomAmount}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <CurrencyPill currency={bottomCurrency} onClick={() => setSelectingFor("bottom")} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 8, letterSpacing: "0.18em", color: "rgba(255,255,255,0.17)" }}>{bottomCurrency.name.toUpperCase()}</div>
                </div>

                <div onClick={() => setExpanded(true)} style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <div style={{ width: 28, height: 1.5, borderRadius: 1, background: "rgba(139,124,255,0.35)" }} />
                  <span style={{ fontSize: 7.5, letterSpacing: "0.18em", color: "rgba(139,124,255,0.32)", textTransform: "uppercase" }}>tension relativa</span>
                </div>
              </div>
            )}

            {expanded && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "4px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 22, fontFamily: "sans-serif", fontWeight: 200, color: "#fff" }}>
                      {topCurrency.symbol || ""}{(20000).toLocaleString("es-MX")}
                    </div>
                    <CurrencyPill currency={topCurrency} onClick={() => setSelectingFor("top")} />
                  </div>
                  <button onClick={swap} style={{
                    width: 31, height: 31, borderRadius: "50%",
                    background: "rgba(139,124,255,0.08)", border: "1px solid rgba(139,124,255,0.22)",
                    cursor: "pointer", color: "rgba(139,124,255,0.72)", fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>⇅</button>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontFamily: "sans-serif", fontWeight: 200, color: "rgba(255,255,255,0.58)" }}>{bottomAmount}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <CurrencyPill currency={bottomCurrency} onClick={() => setSelectingFor("bottom")} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 3, marginBottom: 9 }}>
                  {PERIODS.map((p) => (
                    <button key={p} onClick={() => setPeriod(p)} style={{
                      flex: 1, padding: "5px 0",
                      background: period === p ? "rgba(139,124,255,0.16)" : "transparent",
                      border: period === p ? "1px solid rgba(139,124,255,0.30)" : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 7, cursor: "pointer",
                      color: period === p ? "rgba(139,124,255,0.90)" : "rgba(255,255,255,0.26)",
                      fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.1em",
                    }}>{p}</button>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, padding: "0 2px" }}>
                  <span style={{ fontSize: 7.5, letterSpacing: "0.13em", color: "rgba(139,124,255,0.52)" }}>{topCurrency.label}</span>
                  <span style={{ fontSize: 7.5, letterSpacing: "0.13em", color: "rgba(137,175,255,0.48)" }}>{bottomCurrency.label}</span>
                </div>

                <div style={{ flex: 1, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.035)", marginBottom: 9 }}>
                  <TensionChart topCurrency={topCurrency} bottomCurrency={bottomCurrency} />
                </div>

                <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
                  {[
                    { color: "rgba(139,124,255,0.72)", label: "mayor estabilidad relativa" },
                    { color: "rgba(137,175,255,0.62)", label: "mayor tension / volatilidad" },
                  ].map((item, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.032)", borderRadius: 7, padding: "5px 7px" }}>
                      <div style={{ width: 18, height: 1.5, background: item.color, borderRadius: 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 7, letterSpacing: "0.06em", color: "rgba(255,255,255,0.2)", lineHeight: 1.35 }}>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div onClick={() => setExpanded(false)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", paddingBottom: 5 }}>
                  <span style={{ fontSize: 6.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.1)" }}>DESLIZA ABAJO</span>
                  <div style={{ width: 28, height: 1.5, borderRadius: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "4px 12px 5px" }}>
            <CurrencyBar currencies={CURRENCIES} selected={topCurrency} onSelect={setTopCurrency} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", padding: "5px 0 8px" }}>
            <LensIcon size={20} />
          </div>
          <div style={{ width: 86, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.17)", margin: "0 auto 10px" }} />
        </div>

        <div style={{ position: "absolute", bottom: 26, display: "flex", gap: 26 }}>
          {["PRINCIPAL", "TENSION"].map((label, i) => {
            const active = i === 0 ? !expanded : expanded;
            return (
              <button key={label} onClick={() => setExpanded(i === 1)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: active ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.16)",
                fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.16em",
                borderBottom: active ? "1px solid rgba(139,124,255,0.52)" : "1px solid transparent",
                paddingBottom: 3,
              }}>{label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
