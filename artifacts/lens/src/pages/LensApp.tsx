import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "https://lens-api-qu0x.onrender.com/api/prices";

// ─── Catálogo completo ──ui───────lens───────────────────────────────────────────────
const CATALOG: Record<string, any[]> = {
  Divisas: [
    { id: "MXN", label: "MXN", flag: "🇲🇽", name: "Peso Mexicano" },
    { id: "USD", label: "USD", flag: "🇺🇸", name: "Dólar" },
    { id: "EUR", label: "EUR", flag: "🇪🇺", name: "Euro" },
    { id: "GBP", label: "GBP", flag: "🇬🇧", name: "Libra" },
    { id: "JPY", label: "JPY", flag: "🇯🇵", name: "Yen" },
    { id: "CAD", label: "CAD", flag: "🇨🇦", name: "Dólar Canadiense" },
    { id: "BRL", label: "BRL", flag: "🇧🇷", name: "Real" },
    { id: "CHF", label: "CHF", flag: "🇨🇭", name: "Franco Suizo" },
    { id: "CNY", label: "CNY", flag: "🇨🇳", name: "Yuan" },
    { id: "ARS", label: "ARS", flag: "🇦🇷", name: "Peso Argentino" },
  ],
  Crypto: [
    { id: "BTC", label: "BTC", symbol: "₿", name: "Bitcoin", color: "#F7931A" },
    {
      id: "ETH",
      label: "ETH",
      symbol: "Ξ",
      name: "Ethereum",
      color: "#627EEA",
    },
    { id: "SOL", label: "SOL", symbol: "◎", name: "Solana", color: "#9945FF" },
    { id: "XRP", label: "XRP", symbol: "✕", name: "XRP", color: "#346AA9" },
    { id: "ADA", label: "ADA", symbol: "₳", name: "Cardano", color: "#0D99FF" },
    {
      id: "DOGE",
      label: "DOGE",
      symbol: "Ð",
      name: "Dogecoin",
      color: "#C2A633",
    },
    {
      id: "AVAX",
      label: "AVAX",
      symbol: "▲",
      name: "Avalanche",
      color: "#E84142",
    },
    {
      id: "DOT",
      label: "DOT",
      symbol: "●",
      name: "Polkadot",
      color: "#E6007A",
    },
  ],
  Commodities: [
    { id: "XAU", label: "XAU", symbol: "◈", name: "Oro", color: "#C9A84C" },
    { id: "XAG", label: "XAG", symbol: "◇", name: "Plata", color: "#A8A9AD" },
    {
      id: "WTI",
      label: "WTI",
      symbol: "⬡",
      name: "Petróleo",
      color: "#6B4F2A",
    },
    { id: "CU", label: "CU", symbol: "⬟", name: "Cobre", color: "#B87333" },
  ],
};

const ALL_ASSETS: any[] = Object.values(CATALOG).flat();
const DEFAULT_FAVORITES = ["MXN", "USD", "BTC", "XAU"];

function getAsset(id: string): any {
  return ALL_ASSETS.find((a) => a.id === id) ?? { id, label: id, name: id };
}

// ─── Volatilidad por activo ───────────────────────────────────────────────────
const VOLATILITY: Record<string, number> = {
  USD: 0.006,
  EUR: 0.009,
  GBP: 0.01,
  JPY: 0.012,
  CAD: 0.01,
  BRL: 0.025,
  CHF: 0.007,
  CNY: 0.008,
  ARS: 0.055,
  MXN: 0.038,
  BTC: 0.072,
  ETH: 0.082,
  SOL: 0.095,
  XRP: 0.068,
  ADA: 0.088,
  DOGE: 0.105,
  AVAX: 0.098,
  DOT: 0.09,
  XAU: 0.016,
  XAG: 0.028,
  WTI: 0.042,
  CU: 0.03,
};

// ─── Rates por defecto (fallback) ─────────────────────────────────────────────
const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  MXN: 17.21,
  EUR: 0.849,
  GBP: 0.746,
  JPY: 160.3,
  CAD: 1.39,
  BRL: 5.89,
  CHF: 0.79,
  CNY: 7.27,
  ARS: 1438,
  BTC: 81351,
  ETH: 2357,
  SOL: 167,
  XRP: 1.13,
  ADA: 0.172,
  DOGE: 0.086,
  AVAX: 6.6,
  DOT: 0.96,
  XAU: 2320,
  XAG: 27.5,
  WTI: 78.5,
  CU: 4.2,
};

// ─── buildRates — lee el JSON del API y construye rates normalizados a USD ────
// Forex (MXN, EUR, GBP...): usdRate = unidades por dólar → para convertir: amount / rate
// Crypto (BTC, ETH...): usd = dólares por unidad → rate = precio directo
// XAU/XAG: el API los da como open.er-api metals → invertir (1/rate)
function buildRates(data: any): Record<string, number> {
  const fx = data?.exchangeRates ?? {};
  const px = data?.prices ?? {};

  // helper para leer forex con fallback
  const fxRate = (id: string, fallback: number) => fx[id]?.usdRate ?? fallback;

  // helper para leer crypto con fallback
  const pxRate = (id: string, fallback: number) => px[id]?.usd ?? fallback;

  return {
    USD: 1,
    // Forex — unidades por dólar
    MXN: fxRate("MXN", 17.21),
    EUR: fxRate("EUR", 0.849),
    GBP: fxRate("GBP", 0.746),
    JPY: fxRate("JPY", 160.3),
    CAD: fxRate("CAD", 1.39),
    BRL: fxRate("BRL", 5.89),
    CHF: fxRate("CHF", 0.79),
    CNY: fxRate("CNY", 7.27),
    ARS: fxRate("ARS", 1438),
    // Crypto — dólares por unidad
    BTC: pxRate("BTC", 81351),
    ETH: pxRate("ETH", 2357),
    SOL: pxRate("SOL", 167),
    XRP: pxRate("XRP", 1.13),
    ADA: pxRate("ADA", 0.172),
    DOGE: pxRate("DOGE", 0.086),
    AVAX: pxRate("AVAX", 6.6),
    DOT: pxRate("DOT", 0.96),
    // Commodities — dólares por unidad
    XAU: pxRate("XAU", 2320),
    XAG: pxRate("XAG", 27.5),
    WTI: pxRate("WTI", 78.5),
    CU: pxRate("CU", 4.2),
  };
}

// ─── Tipos de activo ──────────────────────────────────────────────────────────
// "forex"  → rate = unidades por USD  (MXN, EUR, GBP, JPY, CAD, BRL, CHF, CNY, ARS)
// "crypto" → rate = USD por unidad    (BTC, ETH, SOL, XRP, ADA, DOGE, AVAX, DOT, XAU, XAG, WTI, CU)
const FOREX_IDS = new Set([
  "MXN",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "BRL",
  "CHF",
  "CNY",
  "ARS",
]);

function toUSD(
  amount: number,
  id: string,
  rates: Record<string, number>,
): number {
  if (id === "USD") return amount;
  if (FOREX_IDS.has(id)) return amount / rates[id]; // ej: 100 MXN / 17.21 = 5.81 USD
  return amount * rates[id]; // ej: 1 BTC * 81351 = 81351 USD
}

function fromUSD(
  usd: number,
  id: string,
  rates: Record<string, number>,
): number {
  if (id === "USD") return usd;
  if (FOREX_IDS.has(id)) return usd * rates[id]; // ej: 5.81 USD * 17.21 = 100 MXN
  return usd / rates[id]; // ej: 81351 USD / 81351 = 1 BTC
}

function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount;
  const usd = toUSD(amount, from, rates);
  return fromUSD(usd, to, rates);
}

// ─── Formateo por activo ──────────────────────────────────────────────────────
function fmt(v: number, id: string): string {
  if (id === "BTC") return "₿ " + v.toFixed(6);
  if (id === "ETH") return "Ξ " + v.toFixed(4);
  if (id === "SOL") return "◎ " + v.toFixed(4);
  if (id === "XRP") return "✕ " + v.toFixed(4);
  if (id === "ADA") return "₳ " + v.toFixed(2);
  if (id === "DOGE") return "Ð " + v.toFixed(2);
  if (id === "AVAX") return "▲ " + v.toFixed(4);
  if (id === "DOT") return "● " + v.toFixed(4);
  if (id === "XAU") return "◈ " + v.toFixed(4) + " oz";
  if (id === "XAG") return "◇ " + v.toFixed(3) + " oz";
  if (id === "WTI") return "⬡ " + v.toFixed(2) + " bbl";
  if (id === "CU") return "⬟ " + v.toFixed(3) + " lb";
  if (id === "USD")
    return (
      "$ " +
      v.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  if (id === "EUR")
    return (
      "€ " +
      v.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  if (id === "GBP")
    return (
      "£ " +
      v.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  if (id === "JPY") return "¥ " + Math.round(v).toLocaleString("ja-JP");
  if (id === "ARS")
    return (
      "$ " +
      v.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  // resto de forex
  return v.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Gráfica de tensión ───────────────────────────────────────────────────────
function generateWave(points: number, amp: number, bias: number): number[] {
  const data: number[] = [];
  let val = bias;
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5) * amp * 0.09;
    val += (bias - val) * 0.035;
    val = Math.max(bias - amp * 1.2, Math.min(bias + amp * 1.2, val));
    data.push(val);
  }
  return data;
}

function computeParams(
  topId: string,
  botId: string,
  rates: Record<string, number>,
) {
  if (topId === botId) {
    return { topBias: 0.012, botBias: -0.012, topAmp: 0.004, botAmp: 0.004 };
  }
  // valor en USD de cada activo (para calcular fuerza relativa)
  const vTop = FOREX_IDS.has(topId) ? 1 / rates[topId] : (rates[topId] ?? 1);
  const vBot = FOREX_IDS.has(botId) ? 1 / rates[botId] : (rates[botId] ?? 1);
  const total = vTop + vBot;
  const shareTop = vTop / total;
  const shareBot = vBot / total;
  const maxDisp = 0.2;
  const minDisp = 0.04;
  return {
    topBias: minDisp + (1 - shareTop) * maxDisp,
    botBias: -(minDisp + (1 - shareBot) * maxDisp),
    topAmp: VOLATILITY[topId] ?? 0.02,
    botAmp: VOLATILITY[botId] ?? 0.02,
  };
}

function TensionChart({
  topId,
  bottomId,
  rates,
}: {
  topId: string;
  bottomId: string;
  rates: Record<string, number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<any>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);
  const hoverRef = useRef<any>(null);
  const transRef = useRef<any>({ active: false });

  const initData = useCallback(
    (tId: string, bId: string, r: Record<string, number>) => {
      const p = computeParams(tId, bId, r);
      return {
        ...p,
        top: generateWave(120, p.topAmp, p.topBias),
        bot: generateWave(120, p.botAmp, p.botBias),
      };
    },
    [],
  );

  useEffect(() => {
    const next = initData(topId, bottomId, rates);
    if (!dataRef.current) {
      dataRef.current = next;
      return;
    }
    const from = dataRef.current;
    transRef.current = { active: true, from, to: next, alpha: 0 };
    const start = performance.now();
    function fade(now: number) {
      const t = Math.min((now - start) / 800, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      transRef.current.alpha = ease;
      if (t < 1) requestAnimationFrame(fade);
      else {
        dataRef.current = next;
        transRef.current = { active: false };
      }
    }
    requestAnimationFrame(fade);
  }, [topId, bottomId, rates]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    if (!dataRef.current) dataRef.current = initData(topId, bottomId, rates);

    function evolve(d: any) {
      d.top.shift();
      let t = d.top[d.top.length - 1];
      t += (Math.random() - 0.5) * d.topAmp * 0.09;
      t += (d.topBias - t) * 0.035;
      t = Math.max(
        d.topBias - d.topAmp * 1.2,
        Math.min(d.topBias + d.topAmp * 1.2, t),
      );
      d.top.push(t);
      d.bot.shift();
      let b = d.bot[d.bot.length - 1];
      b += (Math.random() - 0.5) * d.botAmp * 0.09;
      b += (d.botBias - b) * 0.035;
      b = Math.max(
        d.botBias - d.botAmp * 1.2,
        Math.min(d.botBias + d.botAmp * 1.2, b),
      );
      d.bot.push(b);
    }

    function drawScene(
      ctx: CanvasRenderingContext2D,
      cW: number,
      cH: number,
      d: any,
      alpha: number,
    ) {
      const n = d.top.length;
      const mid = cH / 2;
      const sc = cH * 1.5;
      const toX = (i: number) => (i / (n - 1)) * cW;
      const toY = (v: number) => mid - v * sc;
      ctx.globalAlpha = alpha;

      // cuadrícula
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.020)";
      ctx.lineWidth = 0.5;
      for (let c = 1; c < 6; c++) {
        ctx.beginPath();
        ctx.moveTo((c / 6) * cW, 0);
        ctx.lineTo((c / 6) * cW, cH);
        ctx.stroke();
      }
      for (let r = 1; r < 6; r++) {
        ctx.beginPath();
        ctx.moveTo(0, (r / 6) * cH);
        ctx.lineTo(cW, (r / 6) * cH);
        ctx.stroke();
      }
      ctx.restore();

      // línea central
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.6;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(cW, mid);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // TOP — opacidad dinámica (campo magnético)
      const topDistNorm = Math.min(Math.abs(d.topBias) / 0.2, 1);
      const topOpacity = 0.3 + topDistNorm * 0.55;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.top[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.strokeStyle = `rgba(200,200,200,${topOpacity})`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // BOT — azul petróleo con fill
      const botDistNorm = Math.min(Math.abs(d.botBias) / 0.2, 1);
      const botOpacity = 0.3 + botDistNorm * 0.6;
      const gBot = ctx.createLinearGradient(0, mid, 0, cH);
      gBot.addColorStop(0, "rgba(30,80,120,0.00)");
      gBot.addColorStop(1, `rgba(30,80,120,${botOpacity * 0.45})`);
      ctx.beginPath();
      ctx.moveTo(toX(0), mid);
      for (let j = 0; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.lineTo(toX(n - 1), mid);
      ctx.closePath();
      ctx.fillStyle = gBot;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.bot[0]));
      for (let j = 1; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.strokeStyle = `rgba(30,100,160,${botOpacity})`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // pulso
      const pulse = (Math.sin(frameRef.current * 0.07) + 1) / 2;
      const lx = toX(n - 1);
      const ly = toY(d.top[n - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,200,${topOpacity})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,200,${0.07 - pulse * 0.06})`;
      ctx.fill();

      // hover
      if (hoverRef.current) {
        const hx = hoverRef.current.x;
        const hi = hoverRef.current.index;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 0.75;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, cH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(hx, toY(d.top[hi]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,200,200,${topOpacity})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, toY(d.bot[hi]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30,100,160,${botOpacity})`;
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      frameRef.current++;
      const c = canvasRef.current;
      if (!c) return;
      const cW = c.width / dpr;
      const cH = c.height / dpr;
      ctx.clearRect(0, 0, cW, cH);
      if (transRef.current.active) {
        drawScene(
          ctx,
          cW,
          cH,
          transRef.current.from,
          1 - transRef.current.alpha,
        );
        drawScene(ctx, cW, cH, transRef.current.to, transRef.current.alpha);
      } else if (dataRef.current) {
        if (frameRef.current % 2 === 0) evolve(dataRef.current);
        drawScene(ctx, cW, cH, dataRef.current, 1);
      }
      animRef.current = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, [topId, bottomId]);

  function onMove(e: any) {
    const c = canvasRef.current;
    if (!c || !dataRef.current) return;
    const rect = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const x = cx - rect.left;
    const n = dataRef.current.top.length;
    hoverRef.current = {
      x,
      index: Math.max(
        0,
        Math.min(n - 1, Math.round((x / rect.width) * (n - 1))),
      ),
    };
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={onMove}
      onMouseLeave={() => {
        hoverRef.current = null;
      }}
      onTouchMove={onMove}
      onTouchEnd={() => {
        hoverRef.current = null;
      }}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "crosshair",
      }}
    />
  );
}

// ─── Asset icon ───────────────────────────────────────────────────────────────
function AssetIcon({ asset, size = 18 }: { asset: any; size?: number }) {
  if (!asset) return null;
  if (asset.symbol)
    return (
      <span
        style={{
          fontSize: size * 0.8,
          color: asset.color || "#fff",
          lineHeight: 1,
        }}
      >
        {asset.symbol}
      </span>
    );
  return <span style={{ fontSize: size, lineHeight: 1 }}>{asset.flag}</span>;
}

// ─── Currency Pill ────────────────────────────────────────────────────────────
function CurrencyPill({ asset, onClick }: { asset: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "6px 12px",
        cursor: "pointer",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 11,
        letterSpacing: "0.1em",
      }}
    >
      <AssetIcon asset={asset} size={15} />
      <span style={{ opacity: 0.78 }}>{asset.label}</span>
      <span style={{ opacity: 0.22, fontSize: 9 }}>▾</span>
    </button>
  );
}

// ─── Favorites bar ────────────────────────────────────────────────────────────
function FavoritesBar({
  favorites,
  selected,
  onSelect,
  onOpenCatalog,
}: {
  favorites: string[];
  selected: string;
  onSelect: (id: string) => void;
  onOpenCatalog: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {favorites.map((id) => {
        const asset = getAsset(id);
        const active = id === selected;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: active
                ? "rgba(255,255,255,0.07)"
                : "rgba(255,255,255,0.03)",
              border: active
                ? "1px solid rgba(255,255,255,0.18)"
                : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "7px 5px",
              cursor: "pointer",
              minWidth: 44,
              transition: "all 0.18s",
            }}
          >
            <AssetIcon asset={asset} size={18} />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 7.5,
                color: active
                  ? "rgba(255,255,255,0.70)"
                  : "rgba(255,255,255,0.30)",
                letterSpacing: "0.06em",
              }}
            >
              {asset.label}
            </span>
          </button>
        );
      })}
      <button
        onClick={onOpenCatalog}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.12)",
          cursor: "pointer",
          color: "rgba(255,255,255,0.28)",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.18s",
          flexShrink: 0,
        }}
      >
        +
      </button>
    </div>
  );
}

// ─── Catalog sheet ────────────────────────────────────────────────────────────
const TABS = Object.keys(CATALOG);

function CatalogSheet({
  favorites,
  onToggle,
  onClose,
}: {
  favorites: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("Divisas");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const isSearching = query.trim().length > 0;
  const filtered = isSearching
    ? ALL_ASSETS.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.name.toLowerCase().includes(query.toLowerCase()),
      )
    : CATALOG[activeTab];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: "#0d0d0d",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "20px 20px 0 0",
          zIndex: 50,
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 8px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 3.5,
              borderRadius: 2,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>

        {/* search */}
        <div style={{ padding: "0 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "9px 12px",
            }}
          >
            <span style={{ fontSize: 13, opacity: 0.3 }}>⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="buscar activo..."
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 12,
                letterSpacing: "0.08em",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* tabs */}
        {!isSearching && (
          <div
            style={{
              display: "flex",
              padding: "0 16px",
              gap: 4,
              marginBottom: 4,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  background:
                    activeTab === tab
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                  border:
                    activeTab === tab
                      ? "1px solid rgba(255,255,255,0.10)"
                      : "1px solid transparent",
                  borderRadius: 8,
                  cursor: "pointer",
                  color:
                    activeTab === tab
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.28)",
                  fontFamily: "monospace",
                  fontSize: 9.5,
                  letterSpacing: "0.1em",
                  transition: "all 0.15s",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "4px 16px 36px" }}>
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "rgba(255,255,255,0.18)",
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: "0.1em",
              }}
            >
              sin resultados
            </div>
          )}
          {filtered.map((asset: any) => {
            const active = favorites.includes(asset.id);
            return (
              <button
                key={asset.id}
                onClick={() => onToggle(asset.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "13px 2px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AssetIcon asset={asset} size={18} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        letterSpacing: "0.09em",
                      }}
                    >
                      {asset.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        opacity: 0.28,
                        marginTop: 2,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {asset.name}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: active
                      ? "rgba(255,255,255,0.88)"
                      : "rgba(255,255,255,0.05)",
                    border: active
                      ? "none"
                      : "1px solid rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {active ? (
                    <span style={{ color: "#000", fontSize: 11 }}>✓</span>
                  ) : (
                    <span
                      style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}
                    >
                      +
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Currency selector (desde favoritos) ──────────────────────────────────────
function CurrencySelector({
  which,
  favorites,
  onSelect,
  onCancel,
}: {
  which: string;
  favorites: string[];
  onSelect: (a: any) => void;
  onCancel: () => void;
}) {
  const assets = favorites.map(getAsset);
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: "#0d0d0d",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "20px 20px 0 0",
          zIndex: 50,
          padding: "16px 16px 40px",
          animation: "slideUp 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 36,
              height: 3.5,
              borderRadius: 2,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 8.5,
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.18)",
            marginBottom: 16,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {which === "top" ? "referencia" : "comparar con"}
        </p>
        {assets.map((a: any) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: "13px 16px",
              marginBottom: 7,
              cursor: "pointer",
              color: "#fff",
              fontFamily: "monospace",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AssetIcon asset={a} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.09em" }}>
                {a.label}
              </div>
              <div style={{ fontSize: 8.5, opacity: 0.25, marginTop: 2 }}>
                {a.name}
              </div>
            </div>
          </button>
        ))}
        <button
          onClick={onCancel}
          style={{
            marginTop: 8,
            width: "100%",
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.12)",
            fontFamily: "monospace",
            fontSize: 9.5,
            letterSpacing: "0.12em",
            cursor: "pointer",
            padding: "10px",
          }}
        >
          cancelar
        </button>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function LensApp() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("lens_favorites") || "null") ||
        DEFAULT_FAVORITES
      );
    } catch {
      return DEFAULT_FAVORITES;
    }
  });

  const [topAsset, setTopAsset] = useState(() => getAsset(favorites[0]));
  const [bottomAsset, setBottomAsset] = useState(() =>
    getAsset(favorites[1] ?? favorites[0]),
  );
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectingFor, setSelectingFor] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [live, setLive] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const rawAmount = parseFloat(inputValue.replace(/,/g, "")) || 0;

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lens_favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    function fetchPrices() {
      fetch(API_URL)
        .then((r) => r.json())
        .then((data) => {
          setRates(buildRates(data));
          setLive(true);
        })
        .catch((e) => console.error(e));
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((f) => f !== id);
      }
      return [...prev, id];
    });
  }

  const bottomValue = convert(rawAmount, topAsset.id, bottomAsset.id, rates);
  const bottomDisplay = rawAmount > 0 ? fmt(bottomValue, bottomAsset.id) : "—";

  function swap() {
    const tmp = topAsset;
    setTopAsset(bottomAsset);
    setBottomAsset(tmp);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    if (!raw) {
      setInputValue("");
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) setInputValue(num.toLocaleString("es-MX"));
  }

  return (
    <>
      <GlobalStyles />
      <div
        style={{
          background: "#050505",
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "monospace",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.9s ease, transform 0.9s ease",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px 20px 0",
          }}
        >
          <span
            style={{
              fontFamily: "sans-serif",
              fontWeight: 200,
              fontSize: 18,
              letterSpacing: "0.38em",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            l e n s
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginTop: 5,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: live ? "#4ade80" : "#444",
                animation: live ? "breathe 2.5s ease-in-out infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: 7.5,
                letterSpacing: "0.18em",
                color: live
                  ? "rgba(74,222,128,0.50)"
                  : "rgba(255,255,255,0.15)",
              }}
            >
              {live ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* PRINCIPAL */}
          {!expanded && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 28px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <input
                  value={inputValue}
                  onChange={handleInput}
                  placeholder="0"
                  style={{
                    fontSize: 58,
                    fontFamily: "sans-serif",
                    fontWeight: 200,
                    color: inputValue ? "#fff" : "rgba(255,255,255,0.18)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    textAlign: "center",
                    width: "100%",
                    caretColor: "rgba(255,255,255,0.4)",
                  }}
                />
                <div style={{ marginTop: 12 }}>
                  <CurrencyPill
                    asset={topAsset}
                    onClick={() => setSelectingFor("top")}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.15)",
                  }}
                >
                  {topAsset.name.toUpperCase()}
                </div>
              </div>

              <button
                onClick={swap}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 17,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "18px 0",
                }}
              >
                ⇅
              </button>

              <div style={{ textAlign: "center", marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 44,
                    fontFamily: "sans-serif",
                    fontWeight: 200,
                    color: "rgba(255,255,255,0.52)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                  }}
                >
                  {bottomDisplay}
                </div>
                <div style={{ marginTop: 12 }}>
                  <CurrencyPill
                    asset={bottomAsset}
                    onClick={() => setSelectingFor("bottom")}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.15)",
                  }}
                >
                  {bottomAsset.name.toUpperCase()}
                </div>
              </div>

              <div
                onClick={() => setExpanded(true)}
                style={{
                  marginTop: 36,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 1,
                    borderRadius: 1,
                    background: "rgba(255,255,255,0.20)",
                  }}
                />
                <span
                  style={{
                    fontSize: 7.5,
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.18)",
                    textTransform: "uppercase",
                  }}
                >
                  tensión relativa
                </span>
              </div>
            </div>
          )}

          {/* TENSIÓN */}
          {expanded && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "20px 16px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 5 }}
                >
                  <CurrencyPill
                    asset={topAsset}
                    onClick={() => setSelectingFor("top")}
                  />
                  <span
                    style={{
                      fontSize: 7.5,
                      letterSpacing: "0.12em",
                      color: "rgba(220,220,220,0.40)",
                      paddingLeft: 2,
                    }}
                  >
                    referencia
                  </span>
                </div>
                <button
                  onClick={swap}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.40)",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⇅
                </button>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    alignItems: "flex-end",
                  }}
                >
                  <CurrencyPill
                    asset={bottomAsset}
                    onClick={() => setSelectingFor("bottom")}
                  />
                  <span
                    style={{
                      fontSize: 7.5,
                      letterSpacing: "0.12em",
                      color: "rgba(30,100,160,0.60)",
                      paddingRight: 2,
                    }}
                  >
                    comparación
                  </span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.005)",
                  border: "1px solid rgba(255,255,255,0.025)",
                  marginBottom: 8,
                }}
              >
                <TensionChart
                  topId={topAsset.id}
                  bottomId={bottomAsset.id}
                  rates={rates}
                />
              </div>

              <div style={{ textAlign: "center", marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 7,
                    letterSpacing: "0.12em",
                    color: "rgba(255,255,255,0.12)",
                    textTransform: "uppercase",
                  }}
                >
                  asset value relation
                </span>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { color: "rgba(200,200,200,0.55)", label: topAsset.label },
                  { color: "rgba(30,100,160,0.75)", label: bottomAsset.label },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.008)",
                      border: "1px solid rgba(255,255,255,0.022)",
                      borderRadius: 7,
                      padding: "5px 8px",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 1.5,
                        background: item.color,
                        borderRadius: 1,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 7.5,
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.25)",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* favorites bar */}
        <div
          style={{
            padding: "8px 10px 6px",
            borderTop: "1px solid rgba(255,255,255,0.035)",
          }}
        >
          <FavoritesBar
            favorites={favorites}
            selected={bottomAsset.id}
            onSelect={(id) => setBottomAsset(getAsset(id))}
            onOpenCatalog={() => setShowCatalog(true)}
          />
        </div>

        {/* tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 32,
            padding: "10px 0 24px",
          }}
        >
          {["PRINCIPAL", "TENSIÓN"].map((label, i) => {
            const active = i === 0 ? !expanded : expanded;
            return (
              <button
                key={label}
                onClick={() => setExpanded(i === 1)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: active
                    ? "rgba(255,255,255,0.50)"
                    : "rgba(255,255,255,0.15)",
                  fontFamily: "monospace",
                  fontSize: 8.5,
                  letterSpacing: "0.16em",
                  borderBottom: active
                    ? "1px solid rgba(255,255,255,0.30)"
                    : "1px solid transparent",
                  paddingBottom: 3,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* catalog sheet */}
      {showCatalog && (
        <CatalogSheet
          favorites={favorites}
          onToggle={toggleFavorite}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {/* currency selector */}
      {selectingFor && (
        <CurrencySelector
          which={selectingFor}
          favorites={favorites}
          onSelect={(a) => {
            if (selectingFor === "top") setTopAsset(a);
            else setBottomAsset(a);
            setSelectingFor(null);
          }}
          onCancel={() => setSelectingFor(null)}
        />
      )}
    </>
  );
}

function GlobalStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { background: #050505; height: 100%; }
      input::placeholder { color: rgba(255,255,255,0.18); }
      @keyframes breathe { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
      @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
      ::-webkit-scrollbar { width: 0; }
    `,
      }}
    />
  );
}
