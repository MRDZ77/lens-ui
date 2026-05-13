import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "https://lens-api-qu0x.onrender.com/api/prices";

const STRENGTH = {
  USD: 0.95,
  EUR: 0.88,
  XAU: 0.8,
  MXN: 0.32,
  BTC: 0.42,
  ETH: 0.38,
};
const VOLATILITY = {
  USD: 0.012,
  EUR: 0.016,
  XAU: 0.022,
  MXN: 0.058,
  BTC: 0.09,
  ETH: 0.105,
};

const CURRENCIES = [
  { id: "MXN", label: "MXN", flag: "🇲🇽", name: "Peso Mexicano" },
  { id: "USD", label: "USD", flag: "🇺🇸", name: "Dólar" },
  { id: "EUR", label: "EUR", flag: "🇪🇺", name: "Euro" },
  { id: "BTC", label: "BTC", symbol: "₿", name: "Bitcoin", color: "#F7931A" },
  { id: "ETH", label: "ETH", symbol: "Ξ", name: "Ethereum", color: "#627EEA" },
  { id: "XAU", label: "XAU", symbol: "◈", name: "Oro", color: "#C9A84C" },
];

const DEFAULT_RATES = {
  MXN: 17.21,
  USD: 1,
  EUR: 1.175,
  BTC: 81351,
  ETH: 2357,
  XAU: 2320,
};

function buildRates(data: any) {
  const eurRaw = data?.exchangeRates?.EUR?.usdRate;
  return {
    USD: 1,
    MXN: data?.exchangeRates?.MXN?.usdRate ?? DEFAULT_RATES.MXN,
    EUR: eurRaw ? 1 / eurRaw : DEFAULT_RATES.EUR,
    BTC: data?.prices?.BTC?.usd ?? DEFAULT_RATES.BTC,
    ETH: data?.prices?.ETH?.usd ?? DEFAULT_RATES.ETH,
    XAU: data?.prices?.XAU?.usd ?? DEFAULT_RATES.XAU,
  };
}

function convert(amount: number, from: string, to: string, rates: any) {
  const usd = from === "USD" ? amount : amount / rates[from];
  return to === "USD" ? usd : usd * rates[to];
}

function fmt(v: number, id: string) {
  if (id === "BTC") return "₿ " + v.toFixed(6);
  if (id === "ETH") return "Ξ " + v.toFixed(4);
  if (id === "XAU") return "◈ " + v.toFixed(4) + " oz";
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
  return (
    "$ " +
    v.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function generateWave(points: number, amplitude: number, bias: number) {
  const data: number[] = [];
  let val = bias;
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5) * amplitude * 0.025;
    val += (bias - val) * 0.05;
    val = Math.max(
      bias - amplitude * 0.4,
      Math.min(bias + amplitude * 0.4, val),
    );
    data.push(val);
  }
  return data;
}

function computeParams(topId: string, botId: string) {
  const sTop = STRENGTH[topId as keyof typeof STRENGTH] ?? 0.5;
  const sBot = STRENGTH[botId as keyof typeof STRENGTH] ?? 0.5;
  const total = sTop + sBot;
  const isSame = topId === botId;
  const maxDisp = isSame ? 0.004 : 0.11;
  const weaknessTop = 1 - sTop / total;
  const weaknessBot = 1 - sBot / total;
  return {
    topBias: weaknessTop * maxDisp,
    botBias: -weaknessBot * maxDisp,
    topAmp: isSame
      ? 0.003
      : (VOLATILITY[topId as keyof typeof VOLATILITY] ?? 0.03),
    botAmp: isSame
      ? 0.003
      : (VOLATILITY[botId as keyof typeof VOLATILITY] ?? 0.03),
  };
}

function TensionChart({
  topCurrency,
  bottomCurrency,
}: {
  topCurrency: any;
  bottomCurrency: any;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<any>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);
  const hoverRef = useRef<any>(null);
  const transRef = useRef<any>({ active: false });

  const initData = useCallback((topId: string, botId: string) => {
    const p = computeParams(topId, botId);
    return {
      ...p,
      top: generateWave(120, p.topAmp, p.topBias),
      bot: generateWave(120, p.botAmp, p.botBias),
    };
  }, []);

  useEffect(() => {
    const next = initData(topCurrency.id, bottomCurrency.id);
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
  }, [topCurrency.id, bottomCurrency.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    if (!dataRef.current)
      dataRef.current = initData(topCurrency.id, bottomCurrency.id);

    function evolve(d: any) {
      d.top.shift();
      let t = d.top[d.top.length - 1];
      t += (Math.random() - 0.5) * d.topAmp * 0.025;
      t += (d.topBias - t) * 0.05;
      t = Math.max(
        d.topBias - d.topAmp * 0.4,
        Math.min(d.topBias + d.topAmp * 0.4, t),
      );
      d.top.push(t);
      d.bot.shift();
      let b = d.bot[d.bot.length - 1];
      b += (Math.random() - 0.5) * d.botAmp * 0.025;
      b += (d.botBias - b) * 0.05;
      b = Math.max(
        d.botBias - d.botAmp * 0.4,
        Math.min(d.botBias + d.botAmp * 0.4, b),
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
      const sc = cH * 3.2;
      const toX = (i: number) => (i / (n - 1)) * cW;
      const toY = (v: number) => mid - v * sc;
      ctx.globalAlpha = alpha;

      // Cuadrícula ultra tenue
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.022)";
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

      // Línea central gris tenue
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

      // Línea TOP — blanco humo, sin fill
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.top[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.strokeStyle = "rgba(220,220,220,0.82)";
      ctx.lineWidth = 1.4;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Línea BOT — azul petróleo con fill hacia abajo
      const gBot = ctx.createLinearGradient(0, mid, 0, cH);
      gBot.addColorStop(0, "rgba(30,80,120,0.00)");
      gBot.addColorStop(1, "rgba(30,80,120,0.28)");
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
      ctx.strokeStyle = "rgba(30,100,160,0.88)";
      ctx.lineWidth = 1.4;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Pulso mínimo en top
      const pulse = (Math.sin(frameRef.current * 0.07) + 1) / 2;
      const lx = toX(n - 1);
      const ly = toY(d.top[n - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220,220,220,0.9)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,220,220,${0.08 - pulse * 0.07})`;
      ctx.fill();

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
        ctx.fillStyle = "rgba(220,220,220,0.8)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, toY(d.bot[hi]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30,100,160,0.8)";
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
  }, [topCurrency.id, bottomCurrency.id]);

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

function CurrencyPill({
  currency,
  onClick,
}: {
  currency: any;
  onClick: () => void;
}) {
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
      {currency.symbol ? (
        <span style={{ color: currency.color || "#fff", fontSize: 13 }}>
          {currency.symbol}
        </span>
      ) : (
        <span style={{ fontSize: 15 }}>{currency.flag}</span>
      )}
      <span style={{ opacity: 0.78 }}>{currency.label}</span>
      <span style={{ opacity: 0.22, fontSize: 9 }}>▾</span>
    </button>
  );
}

function CurrencyBar({
  currencies,
  selected,
  onSelect,
}: {
  currencies: any[];
  selected: any;
  onSelect: (c: any) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {currencies.map((c) => {
        const active = c.id === selected.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
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
            <span style={{ fontSize: 18, lineHeight: 1 }}>
              {c.symbol ? (
                <span style={{ color: c.color || "#fff", fontSize: 15 }}>
                  {c.symbol}
                </span>
              ) : (
                c.flag
              )}
            </span>
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
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CurrencySelector({
  which,
  onSelect,
  onCancel,
}: {
  which: string;
  onSelect: (c: any) => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        background: "#050505",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
      }}
    >
      <div style={{ width: 300 }}>
        <p
          style={{
            color: "rgba(255,255,255,0.18)",
            fontSize: 8.5,
            letterSpacing: "0.2em",
            marginBottom: 22,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {which === "top" ? "referencia" : "comparar con"}
        </p>
        {CURRENCIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
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
            <span style={{ fontSize: 22 }}>
              {c.symbol ? (
                <span style={{ color: (c as any).color || "#fff" }}>
                  {c.symbol}
                </span>
              ) : (
                c.flag
              )}
            </span>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.09em" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 8.5, opacity: 0.25, marginTop: 2 }}>
                {c.name}
              </div>
            </div>
          </button>
        ))}
        <button
          onClick={onCancel}
          style={{
            marginTop: 10,
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
    </div>
  );
}

export default function LensApp() {
  const [topCurrency, setTopCurrency] = useState(CURRENCIES[0]);
  const [bottomCurrency, setBottomCurrency] = useState(CURRENCIES[1]);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectingFor, setSelectingFor] = useState<string | null>(null);
  const [rates, setRates] = useState<any>(DEFAULT_RATES);
  const [live, setLive] = useState(false);
  const [inputValue, setInputValue] = useState("20,000");

  const rawAmount = parseFloat(inputValue.replace(/,/g, "")) || 0;

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
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

  const bottomValue = convert(
    rawAmount,
    topCurrency.id,
    bottomCurrency.id,
    rates,
  );
  const bottomAmount = fmt(bottomValue, bottomCurrency.id);

  function swap() {
    const tmp = topCurrency;
    setTopCurrency(bottomCurrency);
    setBottomCurrency(tmp);
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

  if (selectingFor) {
    return (
      <>
        <GlobalStyles />
        <CurrencySelector
          which={selectingFor}
          onSelect={(c) => {
            if (selectingFor === "top") setTopCurrency(c);
            else setBottomCurrency(c);
            setSelectingFor(null);
          }}
          onCancel={() => setSelectingFor(null)}
        />
      </>
    );
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
        {/* Header */}
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
                  style={{
                    fontSize: 58,
                    fontFamily: "sans-serif",
                    fontWeight: 200,
                    color: "#fff",
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    textAlign: "center",
                    width: "100%",
                    caretColor: "rgba(255,255,255,0.5)",
                  }}
                />
                <div style={{ marginTop: 12 }}>
                  <CurrencyPill
                    currency={topCurrency}
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
                  {topCurrency.name.toUpperCase()}
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
                  {bottomAmount}
                </div>
                <div style={{ marginTop: 12 }}>
                  <CurrencyPill
                    currency={bottomCurrency}
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
                  {bottomCurrency.name.toUpperCase()}
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
                    currency={topCurrency}
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
                    currency={bottomCurrency}
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
                  topCurrency={topCurrency}
                  bottomCurrency={bottomCurrency}
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
                  poder adquisitivo relativo entre activos
                </span>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { color: "rgba(220,220,220,0.70)", label: topCurrency.label },
                  {
                    color: "rgba(30,100,160,0.80)",
                    label: bottomCurrency.label,
                  },
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

        <div
          style={{
            padding: "8px 10px 6px",
            borderTop: "1px solid rgba(255,255,255,0.035)",
          }}
        >
          <CurrencyBar
            currencies={CURRENCIES}
            selected={bottomCurrency}
            onSelect={setBottomCurrency}
          />
        </div>

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
      @keyframes breathe { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
    `,
      }}
    />
  );
}
