import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, W} from './brand';

/* ---------- utilidades ---------- */
export const usePop = (delay = 0, damping = 12) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, stiffness: 180, mass: 0.7}});
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type SceneProps = {dur: number};

/* ---------- marco de teléfono ---------- */
const Phone: React.FC<{width: number; children: React.ReactNode; style?: React.CSSProperties}> = ({width, children, style}) => (
  <div
    style={{
      width,
      borderRadius: 64,
      border: '14px solid #0F2A2A',
      background: '#0F2A2A',
      boxShadow: '0 40px 90px rgba(7,64,62,.35)',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div style={{borderRadius: 50, overflow: 'hidden', background: '#fff'}}>{children}</div>
  </div>
);

/* ---------- 1 · la reserva que no llega ---------- */
export const NoShow: React.FC<SceneProps> = ({dur}) => {
  const frame = useCurrentFrame();
  const pop = usePop(2);
  const cut = Math.round(dur * 0.62); // momento en que se ve que no viene
  const late = frame >= cut;
  const shake = late ? Math.sin((frame - cut) * 2.4) * interpolate(frame - cut, [0, 14], [14, 0], clamp) : 0;
  const hora = frame < dur * 0.3 ? '21:00' : frame < cut ? '21:15' : '21:30';
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 820, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          width: 900,
          background: '#fff',
          borderRadius: 36,
          padding: '48px 52px',
          transform: `scale(${0.7 + 0.3 * pop}) translateX(${shake}px)`,
          opacity: pop,
          boxShadow: '0 30px 80px rgba(0,0,0,.35)',
          fontFamily: FONT,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontSize: 64, fontWeight: 900, color: C.text}}>Mesa 4</div>
          <div style={{fontSize: 72, fontWeight: 900, color: late ? C.danger : C.teal600, fontVariantNumeric: 'tabular-nums'}}>{hora}</div>
        </div>
        <div style={{fontSize: 40, fontWeight: 700, color: C.muted, marginTop: 8}}>Marta · 4 personas</div>
        <div
          style={{
            marginTop: 40,
            display: 'inline-block',
            padding: '16px 34px',
            borderRadius: 999,
            fontSize: 42,
            fontWeight: 800,
            background: late ? '#FBE3E0' : C.teal100,
            color: late ? C.danger : C.teal700,
          }}
        >
          {late ? 'No ha venido' : 'Confirmada'}
        </div>
      </div>
    </div>
  );
};

/* ---------- 2 · el hueco vacío ---------- */
export const Hueco: React.FC<SceneProps> = () => {
  const pop = usePop(0);
  const seats = [0, 1, 2, 3];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 840, display: 'flex', justifyContent: 'center', fontFamily: FONT}}>
      <div style={{width: 900, textAlign: 'center', transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop}}>
        <div
          style={{
            border: `6px dashed ${C.teal200}`,
            borderRadius: 36,
            padding: '56px 40px',
            background: 'rgba(255,255,255,.04)',
          }}
        >
          <div style={{display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 30}}>
            {seats.map((s) => (
              <div key={s} style={{width: 92, height: 92, borderRadius: 999, border: `6px solid ${C.teal200}`, opacity: 0.55}} />
            ))}
          </div>
          <div style={{fontSize: 70, fontWeight: 900, color: '#fff'}}>Mesa 4 · vacía</div>
          <div style={{fontSize: 42, fontWeight: 700, color: C.teal200, marginTop: 10}}>21:00 – 22:30 sin nadie</div>
        </div>
      </div>
    </div>
  );
};

/* ---------- 3 · el cliente reserva solo (widget real) ---------- */
export const Widget: React.FC<SceneProps> = ({dur}) => {
  const frame = useCurrentFrame();
  const pop = usePop(0);
  const tapAt = Math.round(dur * 0.55);
  const done = spring({frame: frame - (tapAt + 5), fps: useVideoConfig().fps, config: {damping: 9, stiffness: 200, mass: 0.7}});
  const ripple = interpolate(frame, [tapAt, tapAt + 14], [0, 1], clamp);
  const pw = 640;
  const ph = (pw * 2532) / 1170;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center'}}>
      <div style={{position: 'relative', transform: `translateY(${(1 - pop) * 160}px) scale(${0.92 + 0.08 * pop})`, opacity: pop}}>
        <Phone width={pw + 28}>
          <div style={{position: 'relative', width: pw, height: ph}}>
            <Img src={staticFile('img/widget-05.png')} style={{position: 'absolute', inset: 0, width: pw, height: ph}} />
            {/* toque sobre «Confirmar reserva» */}
            {ripple > 0 && ripple < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: pw * 0.5 - 70,
                  top: ph * 0.755 - 70,
                  width: 140,
                  height: 140,
                  borderRadius: 999,
                  background: C.coral,
                  opacity: 0.55 * (1 - ripple),
                  transform: `scale(${0.4 + ripple * 1.2})`,
                }}
              />
            )}
          </div>
        </Phone>
        {/* sello gráfico (no es una pantalla de la app) */}
        {frame >= tapAt + 5 && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: ph * 0.62,
              transform: `translateX(-50%) rotate(-5deg) scale(${done})`,
              background: C.success,
              color: '#fff',
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 64,
              padding: '20px 48px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              boxShadow: '0 18px 40px rgba(31,138,76,.45)',
            }}
          >
            ✓ Reserva hecha
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- 4 · el plano de sala en vivo (panel real) ---------- */
export const Plano: React.FC<SceneProps> = ({dur}) => {
  const frame = useCurrentFrame();
  const pop = usePop(0);
  const pw = 640;
  const ph = (pw * 2532) / 1170;
  const scroll = interpolate(frame, [6, dur], [0, -430], clamp);
  const blink = 0.55 + 0.45 * Math.abs(Math.sin(frame / 7));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center'}}>
      <div style={{transform: `translateY(${(1 - pop) * 160}px)`, opacity: pop, position: 'relative'}}>
        <Phone width={pw + 28} style={{height: 1180}}>
          <div style={{width: pw, height: 1152, overflow: 'hidden'}}>
            <Img src={staticFile('img/plano.png')} style={{width: pw, height: ph, transform: `translateY(${scroll}px)`}} />
          </div>
        </Phone>
        <div
          style={{
            position: 'absolute',
            top: -34,
            right: -20,
            background: C.coral,
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 38,
            padding: '12px 28px',
            borderRadius: 999,
            boxShadow: '0 12px 30px rgba(255,107,74,.45)',
          }}
        >
          <span style={{opacity: blink}}>●</span> En vivo
        </div>
      </div>
    </div>
  );
};

/* ---------- 5 · el lío del chat (burbujas genéricas) ---------- */
const MENSAJES: {t: string; yo: boolean}[] = [
  {t: '¿Tenéis mesa para 4 esta noche?', yo: false},
  {t: 'Déjame mirar...', yo: true},
  {t: '¿Y mañana a las 9?', yo: false},
  {t: '¿Me confirmas?', yo: false},
  {t: 'Perdona, ¿seguís abiertos?', yo: false},
];

export const Chat: React.FC<SceneProps> = ({dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const strikeAt = Math.round(dur * 0.55);
  const strike = interpolate(frame, [strikeAt, strikeAt + 10], [0, 1], clamp);
  const dim = interpolate(frame, [strikeAt, strikeAt + 10], [1, 0.28], clamp);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center'}}>
      <div style={{width: 840, position: 'relative', fontFamily: FONT}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26, opacity: dim}}>
          {MENSAJES.map((m, i) => {
            const p = spring({frame: frame - i * 5, fps, config: {damping: 13, stiffness: 190, mass: 0.7}});
            return (
              <div key={i} style={{display: 'flex', justifyContent: m.yo ? 'flex-end' : 'flex-start', opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`}}>
                <div
                  style={{
                    maxWidth: 620,
                    padding: '26px 34px',
                    fontSize: 44,
                    fontWeight: 700,
                    borderRadius: 34,
                    borderBottomLeftRadius: m.yo ? 34 : 8,
                    borderBottomRightRadius: m.yo ? 8 : 34,
                    background: m.yo ? C.teal600 : '#fff',
                    color: m.yo ? '#fff' : C.text,
                    boxShadow: '0 8px 24px rgba(15,42,42,.10)',
                  }}
                >
                  {m.t}
                </div>
              </div>
            );
          })}
        </div>
        {/* tachón */}
        <svg width={840} height={640} viewBox="0 0 840 640" style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={40} y1={600} x2={800} y2={40} stroke={C.coral} strokeWidth={34} strokeLinecap="round" strokeDasharray={1000} strokeDashoffset={1000 * (1 - strike)} />
          <line x1={800} y1={600} x2={40} y2={40} stroke={C.coral} strokeWidth={34} strokeLinecap="round" strokeDasharray={1000} strokeDashoffset={1000 * (1 - interpolate(frame, [strikeAt + 5, strikeAt + 14], [0, 1], clamp))} />
        </svg>
      </div>
    </div>
  );
};

/* ---------- 6 · cierre ---------- */
export const Cierre: React.FC<SceneProps> = () => {
  const logo = usePop(2);
  const cta = usePop(10, 10);
  const sub = usePop(18);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, paddingBottom: 120}}>
      <Img src={staticFile('img/logo-negativo.svg')} style={{width: 640, transform: `scale(${0.6 + 0.4 * logo})`, opacity: logo}} />
      <div
        style={{
          marginTop: 90,
          background: C.coral,
          color: '#fff',
          fontSize: 100,
          fontWeight: 900,
          padding: '28px 74px',
          borderRadius: 999,
          transform: `scale(${0.5 + 0.5 * cta})`,
          opacity: cta,
          boxShadow: '0 20px 50px rgba(0,0,0,.25)',
        }}
      >
        Comenta DEMO
      </div>
      <div style={{marginTop: 40, fontSize: 56, fontWeight: 800, color: C.teal100, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)`}}>y te lo enseño</div>
    </div>
  );
};

export const SCENES = {noshow: NoShow, hueco: Hueco, widget: Widget, plano: Plano, chat: Chat, cierre: Cierre};
export const WIDTH = W;
