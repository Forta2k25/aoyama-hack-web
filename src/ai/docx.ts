/** Wordファイル(.docx)の本文を、この端末で取り出す。docxはzipで、本文は word/document.xml に入っている。 */
export const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export function isDocx(file: File): boolean {
  return file.type === docxMime || /\.docx$/i.test(file.name)
}
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
async function readZipEntry(buffer: ArrayBuffer, wanted: string): Promise<Uint8Array | undefined> {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer)
  let end = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  if (end < 0) throw Error('WEB_Wordファイルを読み取れませんでした。')
  const count = view.getUint16(end + 10, true)
  let p = view.getUint32(end + 16, true)
  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
    const method = view.getUint16(p + 10, true), size = view.getUint32(p + 20, true)
    const nameLength = view.getUint16(p + 28, true), extra = view.getUint16(p + 30, true), comment = view.getUint16(p + 32, true)
    const offset = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength))
    if (name === wanted) {
      const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true)
      const raw = bytes.subarray(start, start + size)
      return method === 0 ? raw : method === 8 ? inflateRaw(raw) : undefined
    }
    p += 46 + nameLength + extra + comment
  }
  return undefined
}
export async function docxText(file: File): Promise<string> {
  if (typeof DecompressionStream !== 'function') throw Error('WEB_このブラウザではWordファイルを読み取れません。PDFにして追加してください。')
  const xml = await readZipEntry(await file.arrayBuffer(), 'word/document.xml')
  if (!xml) throw Error('WEB_Wordファイル(.docx)の本文を読み取れませんでした。古い形式(.doc)はPDFにして追加してください。')
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml')
  const lines: string[] = []
  for (const paragraph of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
    let line = ''
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) continue
        const tag = (child as Element).localName
        if (tag === 't') line += child.textContent ?? ''
        else if (tag === 'tab') line += '\t'
        else if (tag === 'br') line += '\n'
        else walk(child)
      }
    }
    walk(paragraph)
    lines.push(line)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
/** メモは1件10,000文字までなので、段落の区切りで分ける。 */
export function chunkText(text: string, size = 9500): string[] {
  const out: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    for (let rest = line; ; ) {
      const piece = rest.slice(0, size)
      if (current && current.length + piece.length + 1 > size) { out.push(current); current = '' }
      current += (current ? '\n' : '') + piece
      rest = rest.slice(size)
      if (!rest) break
    }
  }
  if (current.trim()) out.push(current)
  return out
}
