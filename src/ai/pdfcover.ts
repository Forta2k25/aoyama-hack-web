/** PDFの1ページ目を、カードの絵にする。pdf.jsは、使うときだけ読み込む。 */
export async function pdfCover(file: File): Promise<Blob | undefined> {
  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    try {
      const page = await doc.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, 480 / base.width) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
      return await new Promise<Blob | undefined>(resolve => canvas.toBlob(b => resolve(b ?? undefined), 'image/jpeg', 0.8))
    } finally { void doc.destroy() }
  } catch { return undefined }
}
