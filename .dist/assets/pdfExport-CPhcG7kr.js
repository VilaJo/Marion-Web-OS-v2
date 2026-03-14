function c(r){return String(r||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function u(){return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(n=>{if(n.tagName.toLowerCase()==="style")return n.outerHTML;const t=n.href;return t?`<link rel="stylesheet" href="${c(t)}" />`:""}).join(`
`)}async function y(r,n,t){const e=window.open("","_blank","width=1200,height=900");if(!e)throw new Error("Popup blocked");const l=n.replace(/\.pdf$/i,""),i=typeof(t==null?void 0:t.pageMarginMm)=="number"?Math.max(0,t.pageMarginMm):10,s=t!=null&&t.landscape?"landscape":"portrait",d=u();e.document.open(),e.document.write(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${c(l)}</title>
    ${d}
    <style>
      @page { size: A4 ${s}; margin: ${i}mm; }
      html, body { background: #fff; }
      body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${(t==null?void 0:t.extraCss)||""}
    </style>
  </head>
  <body>${r}</body>
</html>`),e.document.close(),await new Promise(m=>{const a=()=>m();if(e.document.readyState==="complete"){a();return}e.addEventListener("load",()=>a(),{once:!0}),setTimeout(a,800)}),e.focus(),e.print();const o=()=>{try{e.close()}catch{}};e.onafterprint=o,setTimeout(o,5e3)}async function f(r,n,t){const e=r.cloneNode(!0);e.classList.remove("hidden"),e.style.display="block",e.querySelectorAll(".hidden").forEach(l=>l.classList.remove("hidden")),e.querySelectorAll("[style]").forEach(l=>{l.style.display==="none"&&(l.style.display="block")}),await y(e.outerHTML,n,t)}export{f as p};
