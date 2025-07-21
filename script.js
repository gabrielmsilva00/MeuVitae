const win=window;
const doc=win.document;
const $id=(id)=> doc.getElementById(id);
const $json=(src)=>{try{return JSON.parse(src);}catch{return null;}};
const extractAllStyles=()=>{
  let result='';
  for(const sheet of doc.styleSheets){
    try{
      if(
        sheet.ownerNode.tagName==='STYLE'||
       (sheet.href&&sheet.href.startsWith(location.origin))
      ){
        for(const rule of sheet.cssRules)result+=rule.cssText+'\n';
     }
   }catch{}
 }
  return result;
};
/*ResumeBlock:custom element*/
class ResumeBlock extends HTMLElement{
  constructor(){
    super();
    this.#injectControls();
 }
  #injectControls(){
    const controls=doc.createElement('div');
    controls.className='block-controls';
    controls.innerHTML=`
      <div class="drag-handle"draggable="true"title="Mover este bloco">↕️</div>
      <button class="delete-block-btn"title="Remover este bloco">❌</button>
    `;
    this.prepend(controls);
    controls.querySelector('.delete-block-btn').onclick=()=>{
      this.remove();
      doc.dispatchEvent(new CustomEvent('content-changed'));
   };
 }
}
customElements.define('resume-block',ResumeBlock);
/*THEME ENGINE*/
const THEME_KEYS=[
  '--custom-papel',
  '--custom-texto-de-bloco',
  '--custom-texto-comum',
  '--custom-destaque',
  '--custom-borda'
];
const defaultTheme={
  '--custom-papel':'#FFFFFF',
  '--custom-texto-de-bloco':'#111827',
  '--custom-texto-comum':'#6B7280',
  '--custom-destaque':'#3B82F6',
  '--custom-borda':'#E5E7EB'
};
const ThemeEngine=(()=>{
  let customColors={...defaultTheme};
  function setTheme(theme){
    doc.body.className=`theme-${theme}`;
    localStorage.setItem('resume-theme',theme);
    updateSwatch(theme);
    if(theme==='custom')applyCustomColors();
 }
  function updateSwatch(theme){
    document
      .querySelectorAll('.theme-swatch')
      .forEach((sw)=> sw.classList.toggle('active',sw.dataset.theme===theme));
 }
  function load(){
    const savedTheme=localStorage.getItem('resume-theme');
    const savedColors=$json(localStorage.getItem('resume-custom-colors'))||{};
    Object.assign(customColors,savedColors);
    setColorsOnRoot();
    setTheme(
      savedTheme||
       (window.matchMedia('(prefers-color-scheme:dark)').matches?'dark' :'light'),
    );
 }
  function setColorsOnRoot(){
    for(const key of THEME_KEYS){
      doc.documentElement.style.setProperty(key,customColors[key]);
   }
    try{
      $id('custom-color-preview-foreground').style.backgroundColor =
        customColors['--custom-texto-de-bloco'];
      $id('custom-color-preview-background').style.backgroundColor =
        customColors['--custom-borda'];
   }catch{}
 }
  function applyCustomColors(){
    setColorsOnRoot();
    localStorage.setItem('resume-custom-colors',JSON.stringify(customColors));
 }
  function onCustomizerInput(e){
    const{key,textInputKey}=e.target.dataset;
    if(e.target.type==='color'&&textInputKey&&THEME_KEYS.includes(textInputKey)){
      const txt=this.querySelector(`input[type="text"][data-key="${textInputKey}"]`);
      if(txt)txt.value=e.target.value;
      customColors[textInputKey]=e.target.value;
      applyCustomColors();
      setTheme('custom');
   }else if(
      e.target.type==='text'&&
      key&&
      THEME_KEYS.includes(key)
    ){
      const clr=this.querySelector(
        `input[type="color"][data-text-input-key="${key}"]`,
      );
      if(/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)){
        if(clr)clr.value=e.target.value;
        customColors[key]=e.target.value;
        applyCustomColors();
        setTheme('custom');
     }
   }
 }
  function openCustomizer(){
    const grid=$id('customizer-grid');
    grid.innerHTML=THEME_KEYS.map(
     (k)=> `
        <div class="color-picker-wrapper">
          <label>${k.replace('--custom-','').replace(/-/g,' ')}</label>
          <input type="text"data-key="${k}"value="${customColors[k]}"maxlength="7">
          <input type="color"data-text-input-key="${k}"value="${customColors[k]}">
        </div>
      `,
    ).join('');
    grid.removeEventListener('input',onCustomizerInput);
    grid.addEventListener('input',onCustomizerInput);
    $id('theme-customizer').classList.add('active');
 }
  return{
    init(){
      load();
      document
        .querySelectorAll('.theme-swatch')
        .forEach((sw)=> sw.addEventListener('click',()=> setTheme(sw.dataset.theme)));
      document
        .querySelectorAll('#theme-customizer .close-modal-btn')
        .forEach((el)=>
          el.addEventListener('click',()=>
            $id('theme-customizer').classList.remove('active'),
          ),
        );
   },
    open:openCustomizer,
 };
})();
/*ACTIONS API*/
export const actions=Object.create(null);
export const registerAction=(name,fn)=>(actions[name]=fn);
/*EXPORTING*/
async function exportPdf(filename){
  const{jsPDF}=win.jspdf;
  const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
  const sourceElement=$id('page');
  const sourceRect=sourceElement.getBoundingClientRect();
  const scale=210/sourceRect.width;
  const renderElement=(el)=>{
    const styles=win.getComputedStyle(el);
    const rect=el.getBoundingClientRect();
    const x=(rect.left-sourceRect.left)*scale;
    let y=(rect.top-sourceRect.top)*scale;
    const w=rect.width*scale;
    const fontSizeInPt=parseFloat(styles.fontSize)*0.75;
    const lineHeight=(parseFloat(styles.lineHeight)||(parseFloat(styles.fontSize)*1.5))*scale;
    y+=fontSizeInPt*0.35;
    if(el.tagName==='LI'){
      pdf.setFont('times','normal');
      pdf.setTextColor(styles.color);
      pdf.text('',x+fontSizeInPt*0.35,y);
   }
    const segments=[];
    Array.from(el.childNodes).forEach((child)=>{
      if(child.textContent){
        segments.push({
          text:child.textContent.replace(/\s+/g,' ').trim(),
          styles:win.getComputedStyle(child.nodeType===1?child :el),
          isLink:child.nodeType===1&&child.tagName==='A',
          href:child.nodeType===1?child.href :null,
       });
     }
   });
    let currentLine=[];
    let currentLineWidth=0;
    const lines=[];
    const spaceWidth=pdf.getStringUnitWidth(' ')*fontSizeInPt/pdf.internal.scaleFactor;
    segments.forEach((segment)=>{
      const words=segment.text.split(' ');
      words.forEach((word)=>{
        if(!word)return;
        const segmentFontSize=parseFloat(segment.styles.fontSize)*0.75;
        const fontWeight=parseInt(segment.styles.fontWeight)|| 400;
        const wordWidth=pdf.getStringUnitWidth(word)*segmentFontSize/pdf.internal.scaleFactor;
        pdf.setFontSize(segmentFontSize);
        pdf.setFont('times',fontWeight>500?'bold' :'normal');
        if(currentLineWidth+(currentLine.length>0?spaceWidth :0)+wordWidth>w){
          lines.push({segments:currentLine,width:currentLineWidth});
          currentLine=[{...segment,text:word}];
          currentLineWidth=wordWidth;
       }else{
          currentLine.push({...segment,text:word});
          currentLineWidth+=(currentLine.length>1?spaceWidth:0)+wordWidth;
       }
     });
   });
    if(currentLine.length>0)lines.push({segments:currentLine,width:currentLineWidth});
    let align=styles.textAlign;
    if(align==='start')align='left';
    if(align==='end')align='right';
    if(!['left','center','right','justify'].includes(align))align='left';
    lines.forEach((line,lineIndex)=>{
      let currentX=x;
      const lineY=y+(lineIndex*lineHeight);
      if(align==='center')currentX=x+(w-line.width)/2;
      if(align==='right')currentX=x+w-line.width;
      line.segments.forEach((segment,segIndex)=>{
        const segmentFontSize=parseFloat(segment.styles.fontSize)*0.75;
        const fontWeight=parseInt(segment.styles.fontWeight)|| 400;
        pdf.setFontSize(segmentFontSize);
        pdf.setFont('times',fontWeight>500?'bold' :'normal');
        pdf.setTextColor(segment.styles.color);
        if(segment.isLink){
          pdf.textWithLink(segment.text,currentX,lineY,{url:segment.href});
       }else{
          pdf.text(segment.text,currentX,lineY);
       }
        currentX+=pdf.getStringUnitWidth(segment.text)*segmentFontSize/pdf.internal.scaleFactor;
        if(segIndex < line.segments.length-1)currentX+=spaceWidth;
     });
   });
 };
  sourceElement.querySelectorAll('h1,h2,h3,p,li').forEach(renderElement);
  sourceElement.querySelectorAll('header,h2').forEach((el)=>{
    const styles=win.getComputedStyle(el);
    if(styles.borderBottomStyle!=='none'){
      const rect=el.getBoundingClientRect();
      const x=(rect.left-sourceRect.left)*scale;
      const w=rect.width*scale;
      const borderY=(rect.bottom-sourceRect.top)*scale;
      pdf.setDrawColor(styles.borderBottomColor);
      pdf.setLineWidth(parseFloat(styles.borderBottomWidth)*scale);
      pdf.line(x,borderY,x+w,borderY);
   }
 });
  pdf.save(`${filename}.pdf`);
};
function exportHtml(filename){
  const page=$id('page').cloneNode(true);
  page.querySelectorAll('.block-controls').forEach((e)=> e.remove());
  page.querySelectorAll('[contenteditable]').forEach((e)=> e.removeAttribute('contenteditable'));
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${filename}</title><style>${extractAllStyles()}</style></head><body>${page.outerHTML}</body></html>`;
  const blob=new Blob([html],{type:'text/html'});
  const a=doc.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${filename}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function exportPng(filename){
  $id('page')
    .querySelectorAll('.block-controls')
    .forEach((c)=>(c.style.visibility='hidden'));
  try{
    const canvas=await window.html2canvas($id('page'),{scale:3,useCORS:true});
    const a=doc.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download=`${filename}.png`;
    a.click();
 }finally{
    $id('page')
      .querySelectorAll('.block-controls')
      .forEach((c)=>(c.style.visibility='visible'));
 }
}
export const exporter={pdf:exportPdf,html:exportHtml,png:exportPng};
/*TEMPLATING*/
export function addBlock(templateId){
  const newBlock=$id(templateId).content.cloneNode(true);
  $id('page').appendChild(newBlock);
  doc.dispatchEvent(new CustomEvent('content-changed'));
}
/*FONT*/
export function changeFontSize(block,dir){
  if(!block)return;
  block
    .querySelectorAll('h1,h2,h3,p,li,strong,a')
    .forEach((el)=>{
      const cur=parseFloat(getComputedStyle(el).fontSize);
      const next=dir==='increase'?cur+1 :Math.max(8,cur-1);
      el.style.fontSize=`${next}px`;
   });
  doc.dispatchEvent(new CustomEvent('content-changed'));
}
/*CTX MENU*/
const contextMenu=$id('context-menu');
const blockMenuItems=[
 {label:'Aumentar Fonte',action:'increaseFont'},
 {label:'Diminuir Fonte',action:'decreaseFont'},
 {label:'Inserir Link',action:'insertLink'},
];
const globalMenuItems=[
 {label:'Adicionar Cabeçalho',action:'addHeader'},
 {label:'Adicionar Bloco de Texto',action:'addText'},
 {label:'Adicionar 2 Colunas',action:'addColumns'},
 {type:'separator'},
 {label:'Personalizar Aparência...',action:'customizeTheme'},
 {label:'Editor de HTML Avançado...',action:'editHtml'},
 {type:'separator'},
 {label:'Salvar Como...',action:'openSaveMenu'},
];
let contextMenuTarget=null;
function openContextMenu(e){
  e.preventDefault();
  contextMenu.innerHTML='';
  contextMenu.classList.add('active');
  contextMenuTarget=e.target.closest('resume-block');
  const items=contextMenuTarget?blockMenuItems :globalMenuItems;
  for(const item of items){
    if(item.type==='separator'){
      contextMenu.insertAdjacentHTML('beforeend','<div class="menu-separator"></div>');
   }else{
      const btn=doc.createElement('button');
      btn.className='menu-item';
      btn.textContent=item.label;
      btn.onclick=()=>{
        if(actions[item.action])actions[item.action](contextMenuTarget);
        contextMenu.classList.remove('active');
     };
      contextMenu.appendChild(btn);
   }
 }
  const{clientX:x,clientY:y}=e;
  const menuW=contextMenu.offsetWidth,
    menuH=contextMenu.offsetHeight;
  contextMenu.style.left=`${Math.min(x,window.innerWidth-menuW-5)}px`;
  contextMenu.style.top=`${Math.min(y,window.innerHeight-menuH-5)}px`;
}
doc.addEventListener('contextmenu',openContextMenu);
doc.addEventListener('click',(e)=>{
  if(!contextMenu.contains(e.target))contextMenu.classList.remove('active');
});
/*HOOK*/
export function hookActions(){
  doc.body.addEventListener('click',(e)=>{
    const btn=e.target.closest('button[data-action]');
    if(!btn)return;
    const act=btn.dataset.action;
    if(act&&actions[act])actions[act](contextMenuTarget);
 });
  doc.querySelectorAll('.modal-overlay .close-modal-btn').forEach((el)=>
    el.addEventListener('click',function handler(ev){
      ev.preventDefault();
      let overlay=el.closest('.modal-overlay');
      if(overlay)overlay.classList.remove('active');
   }),
  );
  const saveModal=$id('save-modal');
  if(saveModal){
   //Defensive:always ensure all closes will close modal
    saveModal
      .querySelectorAll('.close-modal-btn')
      .forEach((btn)=> btn.addEventListener('click',()=> saveModal.classList.remove('active')));
   //Ensure EXECUTE triggers saveAll handler
    const execBtn=$id('execute-save-btn');
    if(execBtn)execBtn.onclick=actions.saveAll;
 }
  const htmlModal=$id('html-editor-modal');
  if(htmlModal){
    htmlModal
      .querySelectorAll('.close-modal-btn')
      .forEach((btn)=>
        btn.addEventListener('click',()=> htmlModal.classList.remove('active')),
      );
 }
}
/*INIT*/
export function initApp(){
  ThemeEngine.init();
 //Drag & Drop
 (()=>{
    let dragged=null;
    const page=$id('page');
    page.addEventListener('dragstart',(e)=>{
      if(e.target.matches('.drag-handle')){
        dragged=e.target.closest('resume-block');
        setTimeout(()=> dragged.classList.add('dragging'),0);
     }
   });
    page.addEventListener('dragend',()=>{
      if(dragged){
        dragged.classList.remove('dragging');
        dragged=null;
     }
   });
    page.addEventListener('dragover',(e)=>{
      e.preventDefault();
      if(!dragged)return;
      const tgt=e.target.closest('resume-block');
      if(tgt&&tgt!==dragged){
        const rect=tgt.getBoundingClientRect();
        const after=(e.clientY-rect.top)/rect.height>0.5;
        page.insertBefore(dragged,after?tgt.nextSibling :tgt);
     }
   });
 })();
 //Content Overflow
 (()=>{
    const warning=$id('page-overflow-warning');
    const page=$id('page');
    function overflowing(){
      return page.scrollHeight>page.clientHeight+2;
   }
    function notify(){
      warning.style.display='block';
      warning.style.opacity='1';
      setTimeout(()=>(warning.style.opacity='0'),1800);
   }
    function revertInput(e){
      if(overflowing()){
        e.preventDefault();
        doc.execCommand('undo');
        notify();
     }
   }
    page.addEventListener('input',revertInput,true);
    doc.addEventListener('content-changed',()=>{
      if(overflowing()){
        doc.execCommand('undo');
        notify();
     }
   });
 })();
 //Logo & Info Modal
  for(const id of ['logo-btn','mobile-logo-btn']){
    const btn=$id(id);
    if(!btn)continue;
    btn.addEventListener('click',()=> $id('info-modal').classList.add('active'));
 }
  $id('info-modal')
    ?.querySelectorAll('.close-modal-btn')
    .forEach((x)=>
      x.addEventListener('click',()=> $id('info-modal').classList.remove('active')),
    );
  $id('info-modal')
    ?.querySelectorAll('button[data-action]')
    .forEach((btn)=>
      btn.addEventListener('click',(e)=>{
        e.stopPropagation();
        $id('info-modal').classList.remove('active');
        const a=btn.dataset.action;
        if(actions[a])actions[a]();
     }),
    );
 //HOTKEYS:Intercept Ctrl+S/Ctrl+P(Win)and equivalents(mobile/UI triggers)
  window.addEventListener('keydown',(e)=>{
   //Block Ctrl+S or Ctrl+P anywhere,unless in a modal input/textarea
    if(
     (e.ctrlKey||e.metaKey)&&
     (e.key==='s'||e.key==='S'||e.key==='p'||e.key==='P')
    ){
      const activeTag=doc.activeElement?.tagName?.toUpperCase();
      if(activeTag!=='INPUT'&&activeTag!=='TEXTAREA'){
        e.preventDefault();
       //open Save modal
        actions.openSaveMenu();
     }
   }
 });
 //Defensive:also listen touch "Salvar"/"Imprimir" menu events,as fallback for mobile browsers
  window.addEventListener('beforeprint',(e)=>{
    e.preventDefault();
    actions.openSaveMenu();
    return false;
 });
}
/*ACTIONS*/
actions.openSaveMenu=()=>{
  const saveModal=$id('save-modal');
  if(saveModal)saveModal.classList.add('active');
};
actions.customizeTheme=()=> ThemeEngine.open();
actions.editHtml=()=>{
  const htmlModal=$id('html-editor-modal');
  $id('html-editor').value=$id('page').innerHTML.replace(/></g,'>\n<');
  htmlModal.classList.add('active');
  htmlModal
    .querySelectorAll('.close-modal-btn')
    .forEach((btn)=>
      btn.addEventListener('click',()=> htmlModal.classList.remove('active')),
    );
  $id('save-html-btn').onclick=()=>{
    if(confirm('Salvar o HTML diretamente pode quebrar funcionalidades. Prosseguir?')){
      $id('page').innerHTML=$id('html-editor').value;
      doc.dispatchEvent(new CustomEvent('content-changed'));
      htmlModal.classList.remove('active');
   }
 };
};
actions.addHeader=()=> addBlock('template-block-header');
actions.addText=()=> addBlock('template-block-text');
actions.addColumns=()=> addBlock('template-block-columns');
actions.increaseFont=(target)=> changeFontSize(target,'increase');
actions.decreaseFont=(target)=> changeFontSize(target,'decrease');
actions.insertLink=()=>{
  const url=prompt('Digite a URL:','');
  if(url)doc.execCommand('createLink',false,url);
};
actions.saveAll=async()=>{
  const filename=$id('filename-input')?.value||'curriculo';
  const savePdf=$id('save-as-pdf')?.checked;
  const savePng=$id('save-as-png')?.checked;
  const saveHtml=$id('save-as-html')?.checked;
  $id('save-modal')?.classList.remove('active');
  if(savePdf)await exporter.pdf(filename);
  if(savePng)await exporter.png(filename);
  if(saveHtml)exporter.html(filename);
};