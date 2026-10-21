import {Marked} from 'marked'
import katex from 'katex'
import createDOMPurify from 'dompurify'

const rendered = new WeakMap<HTMLElement,string>()
const purifiers = new WeakMap<Window,ReturnType<typeof createDOMPurify>>()
const escape = (text:string) => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))

/** Assistant presentation only. History/copy/share retain the original Markdown.
 * Incomplete/invalid math remains readable text during streaming and after interruption.
 * Never insert unsanitized model HTML, even when a token looks like a math placeholder.
 */
export function renderAnswer(target:HTMLElement,text:string){
  if(rendered.get(target)===text)return
  rendered.set(target,text)
  target.classList.add('ai-answer-markdown')
  const view=target.ownerDocument.defaultView
  if(!view||text.length>32000){target.textContent=text;return}
  let purify=purifiers.get(view)
  if(!purify){purify=createDOMPurify(view);purifiers.set(view,purify)}
  const maths:{source:string;raw:string;display:boolean}[]=[]
  const placeholder=(raw:string,source:string,display:boolean)=>{
    const id=maths.push({source,raw,display})-1
    return `<span data-ai-math="${id}"></span>`
  }
  // A private parser per render prevents accumulated extensions and cross-message state.
  const parser=new Marked({gfm:true,breaks:true,renderer:{
    html:token=>escape(token.text),
    // No AI-controlled network image fetches. Keep alt text available instead.
    image:token=>escape(token.text),
    link(token){
      const body=this.parser.parseInline(token.tokens)
      try{
        const url=new URL(token.href)
        if(!['https:','http:','mailto:'].includes(url.protocol))return body
        return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${body}</a>`
      }catch{return body}
    }
  },extensions:[{
    name:'displayMath',level:'block',start:src=>src.indexOf('$$'),
    tokenizer(src){const m=/^\$\$([^]*?)\$\$(?:[ \t]*\n|$)/.exec(src);if(m)return {type:'displayMath',raw:m[0],text:m[1]}},
    renderer:token=>`<div class="ai-math-block">${placeholder(token.raw,token.text,true)}</div>`
  },{
    name:'inlineMath',level:'inline',start:src=>src.indexOf('$'),
    tokenizer(src){
      // Match equal delimiters only; never interpret half a display delimiter as inline math.
      const m=/^(\$\$|\$)(?!\$)((?:\\[^]|[^\\$])+?)\1(?!\$)/.exec(src)
      if(m)return {type:'inlineMath',raw:m[0],text:m[2],display:m[1]==='$$'}
    },
    renderer:token=>placeholder(token.raw,token.text,token.display)
  }]})
  try{
    const fragment=purify.sanitize(parser.parse(text,{async:false}),{
      USE_PROFILES:{html:true},RETURN_DOM_FRAGMENT:true,
      ADD_ATTR:['data-ai-math'],FORBID_TAGS:['img','input','form','style'],FORBID_ATTR:['style','id','name']
    })
    for(const node of fragment.querySelectorAll<HTMLElement>('[data-ai-math]')){
      const math=maths[Number(node.dataset.aiMath)];node.removeAttribute('data-ai-math')
      if(!math)continue
      try{
        if(math.source.length>4000)throw Error('MATH_LIMIT')
        const html=katex.renderToString(math.source,{displayMode:math.display,throwOnError:true,trust:false,strict:'error',maxExpand:1000,maxSize:20,output:'htmlAndMathml'})
        node.replaceChildren(purify.sanitize(html,{USE_PROFILES:{html:true,svg:true,mathMl:true},RETURN_DOM_FRAGMENT:true,FORBID_TAGS:['script','style','img','a'],FORBID_ATTR:['id','name']}))
        node.classList.add(math.display?'ai-math-display':'ai-math-inline')
      }catch{node.textContent=math.raw;node.classList.add('ai-math-unfinished')}
    }
    if(!fragment.textContent?.trim()&&text.trim())target.textContent=text
    else target.replaceChildren(fragment)
  }catch{target.textContent=text}
}
