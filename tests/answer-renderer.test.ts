import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {renderAnswer} from '../src/ai/answer-renderer.ts'

const dom=new JSDOM('<!doctype html><main></main>'),doc=dom.window.document
const render=(text:string)=>{const target=doc.createElement('div');renderAnswer(target,text);return target}
test('A: standard Markdown bold and lists',()=>{
 const n=render('**太字**\n\n- 項目1\n- 項目2');assert.equal(n.querySelector('strong')?.textContent,'太字');assert.equal(n.querySelectorAll('li').length,2)
})
test('B: inline math has MathML subscripts, without raw delimiters',()=>{
 const n=render('$S_n$');assert(n.querySelector('.ai-math-inline .katex'));assert(n.querySelector('msub'));assert(!n.textContent!.includes('$'))
})
test('C/D: display fractions, infinity and complex geometric-tail expression',()=>{
 const n=render('$$\n\\frac{1}{2} < c < 2\n$$\n\n$$\n|S_\\infty-S_n|=\\frac{5(\\log_2 1.5)^n}{1-\\log_2 1.5}\n$$');assert.equal(n.querySelectorAll('.katex-display').length,2);assert.equal(n.querySelectorAll('mfrac').length,2);assert(!n.querySelector('.ai-math-unfinished'));assert(n.textContent!.includes('∞'))
})
test('E/F: heading, bold, Japanese, inline and display math coexist',()=>{
 const n=render('### (b) の答え\n\n**答え：$n=9$**\n\n日本語の公比は $r=\\log_2 c$ です。\n\n$$\\frac{1}{2}<c<2$$\n\n**重要**');assert.equal(n.querySelector('h3')?.textContent,'(b) の答え');assert(n.querySelector('strong .katex'));assert.equal(n.querySelectorAll('strong').length,2);assert.equal(n.querySelectorAll('.katex').length,3);assert(n.textContent!.includes('日本語の公比は'))
})
test('every streaming prefix, interrupted/invalid math and final replacement remain readable and do not throw',()=>{
 const text='### 解説\n\n**答え：$n=9$**\n\n日本語。\n\n$$\n\\frac{5(\\log_2 1.5)^n}{1-\\log_2 1.5}\n$$\n\n- 検算済み',target=doc.createElement('div')
 for(let i=1;i<=text.length;i++){assert.doesNotThrow(()=>renderAnswer(target,text.slice(0,i)));assert(target.textContent!.trim().length>0,'must not erase the whole answer')}
 assert.equal(target.querySelectorAll('.katex').length,2)
 renderAnswer(target,'前半の説明。 $\\frac{1}{');assert(target.textContent!.includes('前半の説明'));assert(target.textContent!.includes('\\frac{1}{'))
 renderAnswer(target,'前半の説明。 $\\frac{1}{2}$');assert(target.querySelector('mfrac'))
 for(const s of ['説明 $\\unknowncommand{x}$','説明 $$\\frac{1}{2$$','説明 $$S_n$','説明 $\\def\\x{\\x}\\x$']){renderAnswer(target,s);assert(target.textContent!.startsWith('説明'));assert(!target.querySelector('script'))}
})
test('raw HTML, unsafe links, remote images, forged placeholders and trusted LaTeX commands never execute/fetch',()=>{
 const n=render('<script>alert(1)</script>\n\n<img src="https://invalid.test/tracker" onerror="alert(1)">\n\n<svg onload="alert(1)"></svg>\n\n[攻撃](javascript:alert%281%29) ![画像](https://invalid.test/tracker)\n\n<span data-ai-math="0">偽造</span>\n\n$\\href{javascript:alert(1)}{攻撃}$\n\n$\\includegraphics{https://invalid.test/tracker}$')
 assert.equal(n.querySelectorAll('script,img,svg,iframe,form,input,[onerror],[onload],[data-ai-math]').length,0);assert.equal(n.querySelectorAll('a').length,0);assert(n.textContent!.includes('<script>'));assert(n.textContent!.includes('偽造'))
 const safe=render('[公式](https://example.com/docs)');assert.equal(safe.querySelector('a')?.getAttribute('rel'),'noopener noreferrer')
})
test('code blocks/inline code stay literal, escaped dollars are not math; repeated unchanged render preserves nodes',()=>{
 const n=render('`$S_n$`\n\n```tex\n$S_n$\n```\n\n価格 \\$5。');assert.equal(n.querySelectorAll('.katex').length,0);assert(n.textContent!.includes('$S_n$'))
 renderAnswer(n,'**保存済み**');const first=n.firstChild;renderAnswer(n,'**保存済み**');assert.equal(n.firstChild,first)
})

test('exact screenshot syntax renders: inline log and standalone absolute-value inequality',()=>{
 const n=render('(a)\n無限等比級数が収束する条件は、公比の絶対値が1より小さいことです。\n与えられた和の公比は $r = \\log_2 c$ です。\n\n$$|\\log_2 c| < 1$$\n\nこれを解くと、')
 assert.equal(n.querySelectorAll('.katex').length,2);assert.equal(n.querySelectorAll('.katex-display').length,1);assert(!n.querySelector('.ai-math-unfinished'));assert(!n.textContent!.includes('$'))
})
