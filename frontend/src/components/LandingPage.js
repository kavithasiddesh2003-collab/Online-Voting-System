import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W, H, nodes = [], animId;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function initNodes(n = 90) {
      nodes = [];
      for (let i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 2 + 0.8,
          glow: Math.random(),
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const DIST = 170;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,180,255,${(1 - d / DIST) * 0.22})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 7);
        g.addColorStop(0, `rgba(0,229,255,${0.35 + n.glow * 0.3})`);
        g.addColorStop(1, "rgba(0,100,255,0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 7, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,229,255,${0.7 + n.glow * 0.3})`;
        ctx.fill();

        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        n.glow = (n.glow + 0.004) % 1;
      }

      animId = requestAnimationFrame(draw);
    }

    const handleResize = () => { resize(); initNodes(); };
    window.addEventListener("resize", handleResize);
    resize();
    initNodes();
    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="lp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          position: relative;
          width: 100vw;
          height: 100vh;
          background: #020b1a;
          overflow: hidden;
          font-family: 'Rajdhani', sans-serif;
          color: #e0f4ff;
        }

        .lp-canvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .lp-scanlines {
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        /* NAV */
        .lp-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 1rem 2rem;
          background: rgba(2,11,26,0.7);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,229,255,0.12);
        }

        .lp-nav-links { display: flex; gap: 0.8rem; }

        .lp-btn-ghost {
          font-family: 'Orbitron', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 0.45rem 1.1rem;
          border-radius: 3px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s ease;
          background: transparent;
          border: 1px solid rgba(0,229,255,0.5);
          color: #00e5ff;
        }
        .lp-btn-ghost:hover {
          background: rgba(0,229,255,0.08);
          box-shadow: 0 0 18px rgba(0,229,255,0.3);
        }

        .lp-btn-solid {
          font-family: 'Orbitron', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 0.45rem 1.1rem;
          border-radius: 3px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s ease;
          background: linear-gradient(135deg, #0050cc, #0099ff);
          border: 1px solid rgba(0,229,255,0.4);
          color: #fff;
          box-shadow: 0 0 20px rgba(0,102,255,0.4);
        }
        .lp-btn-solid:hover {
          box-shadow: 0 0 30px rgba(0,229,255,0.6);
          transform: translateY(-1px);
        }

        /* HERO */
        .lp-hero {
          position: relative;
          z-index: 10;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 2.5rem;
        }

        /* HUD WRAPPER — overflow visible so label pokes out */
        .lp-hud-wrapper {
          position: relative;
          padding-top: 1rem; /* space for the label above the frame */
          animation: lp-fadeUp 0.8s ease both;
        }

        /* HUD LABEL — sits above the frame border */
        .lp-hud-label {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Orbitron', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.22em;
          color: #00e5ff;
          background: #020b1a;
          padding: 0.15rem 1rem;
          white-space: nowrap;
          border: 1px solid rgba(0,229,255,0.25);
          text-shadow: 0 0 10px #00e5ff, 0 0 20px rgba(0,229,255,0.5);
          z-index: 2;
        }

        /* HUD FRAME */
        .lp-hud-frame {
          position: relative;
          padding: 3rem 4rem;
          border: 1px solid rgba(0,229,255,0.2);
          background: rgba(0,20,50,0.35);
          backdrop-filter: blur(6px);
          overflow: hidden;
        }

        /* Corner brackets */
        .lp-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: #00e5ff;
          border-style: solid;
        }
        .lp-corner-tl { top: -1px;    left: -1px;  border-width: 2px 0 0 2px; }
        .lp-corner-tr { top: -1px;    right: -1px; border-width: 2px 2px 0 0; }
        .lp-corner-bl { bottom: -1px; left: -1px;  border-width: 0 0 2px 2px; }
        .lp-corner-br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

        /* Scan line */
        .lp-scan-line {
          position: absolute;
          top: 0;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.7), transparent);
          pointer-events: none;
          z-index: 2;
          animation: lp-scan 4s linear infinite;
        }

        /* E-VOTING text */
        .lp-evoting-text {
          font-family: 'Orbitron', monospace;
          font-weight: 900;
          font-size: clamp(3.5rem, 10vw, 7.5rem);
          letter-spacing: 0.06em;
          line-height: 1;
          color: #fff;
          text-shadow:
            0 0 30px rgba(0,229,255,0.9),
            0 0 70px rgba(0,229,255,0.5),
            0 0 130px rgba(0,102,255,0.4);
          animation: lp-flicker 6s ease-in-out infinite;
        }

        .lp-hud-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #00e5ff, transparent);
          opacity: 0.4;
          margin: 0.6rem 0;
        }

        .lp-evoting-sub {
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.95rem;
          font-weight: 300;
          letter-spacing: 0.25em;
          color: rgba(0,229,255,0.6);
          text-transform: uppercase;
        }

        /* GET STARTED BUTTON */
        .lp-btn-cta {
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          padding: 1rem 2.6rem;
          border: 1px solid #00e5ff;
          color: #00e5ff;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          background: rgba(0,229,255,0.05);
          animation: lp-fadeUp 1s ease both 0.5s;
          opacity: 0;
        }
        .lp-btn-cta:hover {
          box-shadow: 0 0 40px rgba(0,229,255,0.55), inset 0 0 30px rgba(0,229,255,0.1);
          transform: translateY(-2px);
          letter-spacing: 0.26em;
        }

        /* FOOTER */
        .lp-footer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100;
          text-align: center;
          padding: 0.8rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.48rem;
          letter-spacing: 0.18em;
          color: rgba(0,229,255,0.2);
          border-top: 1px solid rgba(0,229,255,0.06);
          background: rgba(2,11,26,0.7);
          backdrop-filter: blur(10px);
        }

        /* ── KEYFRAMES ── */
        @keyframes lp-scan {
          0%   { top: 0%;    opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%;  opacity: 0; }
        }

        @keyframes lp-flicker {
          0%, 95%, 100% { opacity: 1;    }
          96%            { opacity: 0.85; }
          97%            { opacity: 1;    }
          98.5%          { opacity: 0.9;  }
        }

        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* Network canvas */}
      <canvas ref={canvasRef} className="lp-canvas" />

      {/* Scanline overlay */}
      <div className="lp-scanlines" />

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-links">
          <button className="lp-btn-ghost" onClick={() => navigate("/register")}>Register</button>
          <button className="lp-btn-solid" onClick={() => navigate("/login")}>Login</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">

        {/* Wrapper keeps overflow visible for the label */}
        <div className="lp-hud-wrapper">

          {/* Label sits ABOVE the frame, fully visible */}
          <div className="lp-hud-label">// SECURE ONLINE VOTING SYSTEM</div>

          {/* Frame */}
          <div className="lp-hud-frame">
            <span className="lp-corner lp-corner-tl" />
            <span className="lp-corner lp-corner-tr" />
            <span className="lp-corner lp-corner-bl" />
            <span className="lp-corner lp-corner-br" />
            <div className="lp-scan-line" />
            <div className="lp-evoting-text">E-VOTING</div>
            <div className="lp-hud-divider" />
            <div className="lp-evoting-sub">Decentralized · Transparent · Secure</div>
          </div>

        </div>

        <button className="lp-btn-cta" onClick={() => navigate("/register")}>
          Get Started →
        </button>

      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        DECENTRALIZED VOTING PROTOCOL — ALL TRANSACTIONS CRYPTOGRAPHICALLY SECURED
      </footer>
    </div>
  );
}