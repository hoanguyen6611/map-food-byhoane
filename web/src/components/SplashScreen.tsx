// Mobile first-open splash. Everything here is inline in the server HTML on
// purpose: the CSS and the decision script run before the first paint, so
// the overlay is there from frame one (no white flash, no page flashing
// first) without waiting for any JS bundle or React hydration.
//
// State lives in a `data-fm-splash` attribute on <html> (on → complete →
// hiding → off), set only by the inline script below — React never renders
// that attribute, so it never fights hydration over it. The page itself
// renders normally underneath the whole time (SEO/LCP unaffected).

const SPLASH_CSS = `
#fm-splash{display:none}
html[data-fm-splash=on] #fm-splash,
html[data-fm-splash=complete] #fm-splash,
html[data-fm-splash=hiding] #fm-splash{display:flex}
html[data-fm-splash=on],html[data-fm-splash=on] body,
html[data-fm-splash=complete],html[data-fm-splash=complete] body,
html[data-fm-splash=hiding],html[data-fm-splash=hiding] body{overflow:hidden}
#fm-splash{position:fixed;inset:0;z-index:2147483647;height:100vh;height:100dvh;
flex-direction:column;align-items:center;justify-content:center;
padding:env(safe-area-inset-top,0px) 24px env(safe-area-inset-bottom,0px);
background:linear-gradient(180deg,#003CFF 0%,#0638CD 100%);color:#fff;
font-family:var(--font-archivo),system-ui,-apple-system,sans-serif;
opacity:1;transition:opacity .2s ease;box-sizing:border-box}
html[data-fm-splash=hiding] #fm-splash{opacity:0;pointer-events:none}
.fm-splash-center{display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.fm-splash-logo{position:relative;width:92px;height:92px;border-radius:26px;
background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);
box-shadow:0 12px 32px -8px rgba(2,6,23,.35);display:flex;align-items:center;justify-content:center;
box-sizing:border-box;animation:fm-splash-logo .65s cubic-bezier(.2,.7,.2,1) both}
.fm-splash-dot{position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;
background:linear-gradient(180deg,#FF00FF 0%,#DD00D8 100%);border:2px solid #0638CD;box-sizing:border-box}
.fm-splash-text{display:flex;flex-direction:column;align-items:center;gap:6px;
animation:fm-splash-rise .5s cubic-bezier(.2,.7,.2,1) .25s both}
.fm-splash-title{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.fm-splash-tagline{font-size:13px;line-height:1.5;color:rgba(255,255,255,.88);max-width:280px}
.fm-splash-bottom{position:absolute;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));
display:flex;flex-direction:column;align-items:center;gap:12px;
font-family:var(--font-figtree),system-ui,-apple-system,sans-serif}
.fm-splash-track{width:168px;height:4px;border-radius:999px;background:rgba(255,255,255,.22);overflow:hidden}
.fm-splash-fill{width:0;height:100%;border-radius:999px;background:#fff;
animation:fm-splash-bar 1.8s cubic-bezier(.4,.1,.2,1) forwards}
html[data-fm-splash=complete] .fm-splash-fill,
html[data-fm-splash=hiding] .fm-splash-fill{animation:fm-splash-bar-end .15s ease-out forwards}
.fm-splash-loading{font-size:12px;color:rgba(255,255,255,.88)}
.fm-splash-domain{font-size:11px;color:rgba(255,255,255,.75);margin-top:6px}
@keyframes fm-splash-logo{0%{opacity:0;transform:scale(.82)}60%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
@keyframes fm-splash-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes fm-splash-bar{from{width:0}to{width:90%}}
@keyframes fm-splash-bar-end{from{width:90%}to{width:100%}}
html[data-fm-splash=on] #fm-splash{animation:fm-splash-failsafe 0s linear 5s forwards}
html[data-fm-splash=on],html[data-fm-splash=on] body{animation:fm-splash-unlock 0s linear 5s forwards}
@keyframes fm-splash-failsafe{to{visibility:hidden;opacity:0;pointer-events:none}}
@keyframes fm-splash-unlock{to{overflow-y:auto}}
@media (prefers-reduced-motion:reduce){
#fm-splash{transition:none}
.fm-splash-logo,.fm-splash-text,.fm-splash-fill,
html[data-fm-splash=complete] .fm-splash-fill{animation:none}
.fm-splash-fill{width:100%}
}
`;

// Decides show/skip before paint, then owns the whole lifecycle. Kept
// dependency-free ES5 so it can't be broken by anything else on the page;
// the CSS failsafe above still hides the overlay at 5s if it ever dies.
const SPLASH_SCRIPT = `(function(){
var d=document.documentElement,show=false;
try{
var ua=navigator.userAgent||'';
var bot=/bot|crawl|spider|slurp|lighthouse|pagespeed|headless|prerender|facebookexternalhit|embedly|preview/i.test(ua);
var narrow=window.matchMedia('(max-width: 768px)').matches;
var seen=false;
try{seen=sessionStorage.getItem('fm_splash_seen')==='1'}catch(e){}
show=narrow&&!bot&&!seen;
if(show){try{sessionStorage.setItem('fm_splash_seen','1')}catch(e){}}
}catch(e){show=false}
if(!show){d.setAttribute('data-fm-splash','off');return}
d.setAttribute('data-fm-splash','on');
var meta=document.createElement('meta');
meta.name='theme-color';meta.content='#003CFF';
document.head.insertBefore(meta,document.head.firstChild);
var reduce=false;
try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
var start=Date.now(),MIN=1200,MAX=4000,done=false;
function setInert(on){var app=document.getElementById('fm-app');if(app){if(on){app.setAttribute('inert','')}else{app.removeAttribute('inert')}}}
document.addEventListener('DOMContentLoaded',function(){if(!done)setInert(true)});
function cleanup(){d.setAttribute('data-fm-splash','off');if(meta.parentNode)meta.parentNode.removeChild(meta);setInert(false)}
function finish(now){
if(done)return;done=true;
if(now||reduce){cleanup();return}
d.setAttribute('data-fm-splash','complete');
setTimeout(function(){d.setAttribute('data-fm-splash','hiding');setTimeout(cleanup,200)},150);
}
function ready(){setTimeout(function(){finish(false)},Math.max(0,MIN-(Date.now()-start)))}
if(document.readyState==='complete'){ready()}else{window.addEventListener('load',ready)}
setTimeout(function(){finish(false)},MAX);
window.addEventListener('pageshow',function(e){if(e.persisted)finish(true)});
})();`;

/** Goes inside the root layout's <head>. */
export function SplashHead() {
  return (
    <>
      <style id="fm-splash-css" dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <script id="fm-splash-js" dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      <noscript dangerouslySetInnerHTML={{ __html: '<style>#fm-splash{display:none!important}</style>' }} />
    </>
  );
}

interface OverlayProps {
  siteName: string;
  tagline: string;
  loadingText: string;
  ariaLabel: string;
  domain: string;
}

/** Must be the first element inside <body>. */
export function SplashOverlay({ siteName, tagline, loadingText, ariaLabel, domain }: OverlayProps) {
  return (
    <div id="fm-splash" role="status" aria-live="polite" aria-label={ariaLabel}>
      <div className="fm-splash-center">
        <div className="fm-splash-logo" aria-hidden="true">
          <svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 3.5 4 6v14l5-2.5 6 3 5-2.5V4l-5 2.5z" />
            <path d="M9 3.5v14M15 6.5v14" />
          </svg>
          <span className="fm-splash-dot" aria-hidden="true" />
        </div>
        <div className="fm-splash-text">
          <span className="fm-splash-title">{siteName}</span>
          <span className="fm-splash-tagline">{tagline}</span>
        </div>
      </div>
      <div className="fm-splash-bottom">
        <div className="fm-splash-track" aria-hidden="true">
          <div className="fm-splash-fill" />
        </div>
        <span className="fm-splash-loading">{loadingText}</span>
        <span className="fm-splash-domain">{domain}</span>
      </div>
    </div>
  );
}
