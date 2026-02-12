function f(t,n,e,c){const a=n.map(i=>i.header).join(";"),d=t.map(i=>n.map(s=>{const p=s.format?s.format(i[s.key],i):i[s.key],r=String(p??"");return r.includes(";")||r.includes('"')||r.includes(`
`)?`"${r.replace(/"/g,'""')}"`:r}).join(";")),o="\uFEFF"+[a,...d].join(`
`);l(o,e,"text/csv;charset=utf-8")}function h(t,n,e,c=";"){const u="\uFEFF"+[t.join(c),...n.map(a=>a.map(d=>{const o=String(d??"");return o.includes(c)||o.includes('"')||o.includes(`
`)?`"${o.replace(/"/g,'""')}"`:o}).join(c))].join(`
`);l(u,e,"text/csv;charset=utf-8")}function l(t,n,e){const c=new Blob([t],{type:e});b(c,n)}function b(t,n){const e=document.createElement("a");e.href=URL.createObjectURL(t),e.download=n,document.body.appendChild(e),e.click(),document.body.removeChild(e),setTimeout(()=>URL.revokeObjectURL(e.href),1e3)}export{h as a,f as e};
