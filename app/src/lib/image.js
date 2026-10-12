// Screenshot → downscaled JPEG data URL for Claude vision. Shared by the calendar and
// practice-import modals. Rejects non-images and oversized files before canvas decode.
export const MAX_DIM = 1568 // Anthropic's documented vision token-efficiency sweet spot
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function downscaleImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(fileOrBlob)
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = e => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
