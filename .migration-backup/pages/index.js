import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "https://lens-api-qu0x.onrender.com/api/prices";

// Fuerza económica relativa (1 = más fuerte, 0 = más débil)
const STRENGTH = {
  USD: 0.95,
  EUR: 0.88,
  XAU: 0.8,
  MXN: 0.32,
  BTC: 0.42,
  ETH: 0.38,
};
// Volatilidad base de cada moneda
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
  EUR: 0.849,
  BTC: 81351,
  ETH: 2357,
  XAU: 2320,
};

function buildRates(data) {
  return {
    USD: 1,
    MXN: data?.exchangeRates?.MXN?.usdRate ?? DEFAULT_RATES.MXN,
    EUR: data?.exchangeRates?.EUR?.usdRate ?? DEFAULT_RATES.EUR,
    BTC: data?.prices?.BTC?.usd ?? DEFAULT_RATES.BTC,
    ETH: data?.prices?.ETH?.usd ?? DEFAULT_RATES.ETH,
    XAU: data?.prices?.XAU?.usd ?? DEFAULT_RATES.XAU,
  };
}

function convert(amount, from, to, rates) {
  const usd = from === "USD" ? amount : amount / rates[from];
  return to === "USD" ? usd : usd * rates[to];
}

function fmt(v, id) {
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

// Genera onda con bias = desplazamiento del centro según fuerza relativa
// bias positivo = arriba del centro, bias negativo = abajo
function generateWave(points, amplitude, bias) {
  const data = [];
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

// La clave: calcula cuánto se desplaza cada línea del centro
// basado en la fuerza RELATIVA entre las dos monedas
function computeParams(topId, botId) {
  const sTop = STRENGTH[topId] ?? 0.5;
  const sBot = STRENGTH[botId] ?? 0.5;
  const total = sTop + sBot;

  // La moneda más débil se aleja más del centro
  // La más fuerte se queda más cerca
  const maxDisp = 0.12; // desplazamiento máximo posible

  // topBias: positivo = arriba. La moneda top se va arriba si es MÁS DÉBIL que bot
  // porque su "tensión" la jala hacia fuera
  const weaknessTop = 1 - sTop / total; // 0 = muy fuerte, 1 = muy débil
  const weaknessBot = 1 - sBot / total;

  return {
    topBias: weaknessTop * maxDisp, // top line: arriba del centro, más si es débil
    botBias: -weaknessBot * maxDisp, // bot line: abajo del centro, más si es débil
    topAmp: VOLATILITY[topId] ?? 0.03,
    botAmp: VOLATILITY[botId] ?? 0.03,
  };
}

function TensionChart({ topCurrency, bottomCurrency }) {
  const canvasRef = useRef(null);
  const dataRef = useRef(null);
  const frameRef = useRef(0);
  const animRef = useRef(null);
  const hoverRef = useRef(null);
  const transRef = useRef({ active: false });

  const initData = useCallback((topId, botId) => {
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
    const dur = 800;
    const start = performance.now();
    function fade(now) {
      const t = Math.min((now - start) / dur, 1);
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
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    if (!dataRef.current)
      dataRef.current = initData(topCurrency.id, bottomCurrency.id);

    function evolve(d) {
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

    function drawScene(ctx, cW, cH, d, alpha) {
      const n = d.top.length;
      const mid = cH / 2;
      const sc = cH * 3.2;
      const toX = (i) => (i / (n - 1)) * cW;
      const toY = (v) => mid - v * sc;

      ctx.globalAlpha = alpha;

      // Cuadrícula ultra tenue - papel técnico oscuro
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
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

      // Línea central - visible pero tenue, sin números
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.75;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(cW, mid);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Fill superior (top currency)
      const gTop = ctx.createLinearGradient(0, 0, 0, mid);
      gTop.addColorStop(0, "rgba(139,124,255,0.18)");
      gTop.addColorStop(1, "rgba(139,124,255,0.00)");
      ctx.beginPath();
      ctx.moveTo(toX(0), mid);
      for (let i = 0; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.lineTo(toX(n - 1), mid);
      ctx.closePath();
      ctx.fillStyle = gTop;
      ctx.fill();

      // Línea top
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.top[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(d.top[i]));
      ctx.strokeStyle = "rgba(139,124,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Fill inferior (bottom currency)
      const gBot = ctx.createLinearGradient(0, mid, 0, cH);
      gBot.addColorStop(0, "rgba(100,180,255,0.00)");
      gBot.addColorStop(1, "rgba(100,180,255,0.18)");
      ctx.beginPath();
      ctx.moveTo(toX(0), mid);
      for (let j = 0; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.lineTo(toX(n - 1), mid);
      ctx.closePath();
      ctx.fillStyle = gBot;
      ctx.fill();

      // Línea bot
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(d.bot[0]));
      for (let j = 1; j < n; j++) ctx.lineTo(toX(j), toY(d.bot[j]));
      ctx.strokeStyle = "rgba(100,180,255,0.75)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Pulso en el punto más reciente (top)
      const pulse = (Math.sin(frameRef.current * 0.07) + 1) / 2;
      const lx = toX(n - 1);
      const ly = toY(d.top[n - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(139,124,255,1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 5 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,124,255,${0.12 - pulse * 0.1})`;
      ctx.fill();

      // Hover crosshair
      if (hoverRef.current) {
        const hx = hoverRef.current.x;
        const hi = hoverRef.current.index;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 0.75;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, cH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(hx, toY(d.top[hi]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(139,124,255,0.9)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, toY(d.bot[hi]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,180,255,0.8)";
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

  function onMove(e) {
    const c = canvasRef.current;
    if (!c || !dataRef.current) return;
    const rect = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const x = cx - rect.left;
    const n = dataRef.current.top.length;
    const index = Math.max(
      0,
      Math.min(n - 1, Math.round((x / rect.width) * (n - 1))),
    );
    hoverRef.current = { x, index };
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

function LensIcon({ size = 32, pulse = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1.5px solid rgba(255,255,255,${pulse ? 0.65 : 0.4})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: pulse ? "lensGlow 3.5s ease-in-out infinite" : "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      />
    </div>
  );
}

function CurrencyPill({ currency, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
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
      <span style={{ opacity: 0.8 }}>{currency.label}</span>
      <span style={{ opacity: 0.25, fontSize: 9 }}>▾</span>
    </button>
  );
}

// Barra inferior: siempre muestra flag/ícono, cambia la moneda de ABAJO
function CurrencyBar({ currencies, selected, onSelect }) {
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
                ? "rgba(139,124,255,0.14)"
                : "rgba(255,255,255,0.03)",
              border: active
                ? "1px solid rgba(139,124,255,0.35)"
                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "7px 5px",
              cursor: "pointer",
              minWidth: 42,
              transition: "all 0.18s",
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>
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
                  ? "rgba(139,124,255,0.90)"
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

function CurrencySelector({ which, onSelect, onCancel }) {
  return (
    <div
      style={{
        background: "#070707",
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
            color: "rgba(255,255,255,0.20)",
            fontSize: 8.5,
            letterSpacing: "0.2em",
            marginBottom: 22,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          seleccionar {which === "top" ? "referencia" : "comparar con"}
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
              background: "rgba(255,255,255,0.025)",
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
                <span style={{ color: c.color || "#fff" }}>{c.symbol}</span>
              ) : (
                c.flag
              )}
            </span>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.09em" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 8.5, opacity: 0.28, marginTop: 2 }}>
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
            color: "rgba(255,255,255,0.14)",
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
  const [topCurrency, setTopCurrency] = useState(CURRENCIES[0]); // MXN
  const [bottomCurrency, setBottomCurrency] = useState(CURRENCIES[1]); // USD
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [live, setLive] = useState(false);
  const [inputValue, setInputValue] = useState("20,000");
  const touchStartY = useRef(null);

  // Valor numérico real del input
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
        .catch((e) => console.error("API error", e));
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

  // Input numérico con formato
  function handleInput(e) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    if (!raw) {
      setInputValue("");
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      setInputValue(num.toLocaleString("es-MX"));
    }
  }

  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy > 35) setExpanded(true);
    if (dy < -35) setExpanded(false);
    touchStartY.current = null;
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
          background: "#070707",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          style={{
            width: 320,
            height: 695,
            background: "#090909",
            borderRadius: 46,
            border: "1px solid rgba(255,255,255,0.065)",
            boxShadow:
              "0 50px 130px rgba(0,0,0,0.88), inset 0 0 0 1px rgba(255,255,255,0.032)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.9s ease, transform 0.9s ease",
          }}
        >
          {/* Status bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 22px 0",
              fontSize: 10,
              color: "rgba(255,255,255,0.38)",
              letterSpacing: "0.04em",
            }}
          >
            <span>9:41</span>
            <span>▲▲ ◆ ▌▌▌</span>
          </div>

          {/* Header — solo "lens" centrado + LIVE debajo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 20px 6px",
            }}
          >
            <span
              style={{
                fontFamily: "sans-serif",
                fontWeight: 200,
                fontSize: 17,
                letterSpacing: "0.38em",
                color: "rgba(255,255,255,0.82)",
              }}
            >
              l e n s
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: live ? "#4ade80" : "#555",
                  animation: live
                    ? "breathe 2.5s ease-in-out infinite"
                    : "none",
                }}
              />
              <span
                style={{
                  fontSize: 7.5,
                  letterSpacing: "0.18em",
                  color: live
                    ? "rgba(74,222,128,0.55)"
                    : "rgba(255,255,255,0.18)",
                }}
              >
                {live ? "LIVE" : "OFFLINE"}
              </span>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* PANTALLA PRINCIPAL */}
            {!expanded && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 20px",
                }}
              >
                {/* Moneda de arriba — input editable */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <input
                    value={inputValue}
                    onChange={handleInput}
                    style={{
                      fontSize: 52,
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
                      caretColor: "rgba(139,124,255,0.8)",
                    }}
                  />
                  <div style={{ marginTop: 10 }}>
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
                      color: "rgba(255,255,255,0.17)",
                    }}
                  >
                    {topCurrency.name.toUpperCase()}
                  </div>
                </div>

                {/* Botón swap */}
                <button
                  onClick={swap}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(139,124,255,0.10)",
                    border: "1px solid rgba(139,124,255,0.30)",
                    cursor: "pointer",
                    color: "rgba(139,124,255,0.85)",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "14px 0",
                    transition: "background 0.2s",
                  }}
                >
                  ⇅
                </button>

                {/* Moneda de abajo — resultado */}
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <div
                    style={{
                      fontSize: 42,
                      fontFamily: "sans-serif",
                      fontWeight: 200,
                      color: "rgba(255,255,255,0.60)",
                      letterSpacing: "-0.01em",
                      lineHeight: 1,
                    }}
                  >
                    {bottomAmount}
                  </div>
                  <div style={{ marginTop: 10 }}>
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
                      color: "rgba(255,255,255,0.17)",
                    }}
                  >
                    {bottomCurrency.name.toUpperCase()}
                  </div>
                </div>

                {/* Hint tensión */}
                <div
                  onClick={() => setExpanded(true)}
                  style={{
                    marginTop: 26,
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
                      height: 1.5,
                      borderRadius: 1,
                      background: "rgba(139,124,255,0.35)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 7.5,
                      letterSpacing: "0.18em",
                      color: "rgba(139,124,255,0.32)",
                      textTransform: "uppercase",
                    }}
                  >
                    tensión relativa
                  </span>
                </div>
              </div>
            )}

            {/* PANTALLA TENSIÓN */}
            {expanded && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  padding: "6px 16px 0",
                }}
              >
                {/* Header tensión — solo selección de monedas, sin input */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
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
                        color: "rgba(139,124,255,0.55)",
                        paddingLeft: 2,
                      }}
                    >
                      referencia
                    </span>
                  </div>

                  <button
                    onClick={swap}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "rgba(139,124,255,0.08)",
                      border: "1px solid rgba(139,124,255,0.22)",
                      cursor: "pointer",
                      color: "rgba(139,124,255,0.72)",
                      fontSize: 13,
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
                        color: "rgba(100,180,255,0.50)",
                        paddingRight: 2,
                      }}
                    >
                      comparación
                    </span>
                  </div>
                </div>

                {/* Gráfica */}
                <div
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.008)",
                    border: "1px solid rgba(255,255,255,0.03)",
                    marginBottom: 8,
                  }}
                >
                  <TensionChart
                    topCurrency={topCurrency}
                    bottomCurrency={bottomCurrency}
                  />
                </div>

                {/* Leyenda */}
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {[
                    {
                      color: "rgba(139,124,255,0.75)",
                      label: topCurrency.label + " — más estable",
                    },
                    {
                      color: "rgba(100,180,255,0.65)",
                      label: bottomCurrency.label + " — comparación",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(255,255,255,0.010)",
                        border: "1px solid rgba(255,255,255,0.028)",
                        borderRadius: 7,
                        padding: "5px 7px",
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
                          fontSize: 7,
                          letterSpacing: "0.05em",
                          color: "rgba(255,255,255,0.20)",
                          lineHeight: 1.35,
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  onClick={() => setExpanded(false)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    paddingBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 6.5,
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.10)",
                    }}
                  >
                    DESLIZA ABAJO
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 1.5,
                      borderRadius: 1,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barra de monedas — cambia la de ABAJO */}
          <div style={{ padding: "4px 10px 5px" }}>
            <CurrencyBar
              currencies={CURRENCIES}
              selected={bottomCurrency}
              onSelect={setBottomCurrency}
            />
          </div>

          {/* Bottom nav */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 28,
              padding: "6px 0 8px",
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
                      ? "rgba(255,255,255,0.55)"
                      : "rgba(255,255,255,0.18)",
                    fontFamily: "monospace",
                    fontSize: 8.5,
                    letterSpacing: "0.16em",
                    borderBottom: active
                      ? "1px solid rgba(139,124,255,0.55)"
                      : "1px solid transparent",
                    paddingBottom: 3,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              width: 86,
              height: 3.5,
              borderRadius: 2,
              background: "rgba(255,255,255,0.15)",
              margin: "0 auto 10px",
            }}
          />
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
      body { background: #070707; }
      input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      @keyframes lensGlow {
        0%,100% { box-shadow: 0 0 0 0 rgba(139,124,255,0); }
        50%      { box-shadow: 0 0 14px 2px rgba(139,124,255,0.18); }
      }
      @keyframes breathe {
        0%,100% { opacity: 0.50; }
        50%      { opacity: 1; }
      }
    `,
      }}
    />
  );
}
