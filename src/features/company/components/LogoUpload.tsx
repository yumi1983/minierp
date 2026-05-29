import { useRef, useState } from 'react'
import { Upload, X, Building2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/utils/cn'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
  onUpload: (file: File) => Promise<string>
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export function LogoUpload({ value, onChange, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(value)

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG, WEBP o SVG')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('El archivo no debe superar 2MB')
      return
    }

    setError(null)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    setUploading(true)
    try {
      const url = await onUpload(file)
      onChange(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[LogoUpload] Error:', msg)
      setError(`Error: ${msg}`)
      setPreview(value)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          'relative flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          'hover:border-primary/50 hover:bg-accent/50',
          uploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Logo"
              className="h-full w-full rounded-lg object-contain p-2"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove() }}
              className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {uploading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <>
                <div className="rounded-full bg-muted p-3">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">
                    <span className="text-primary">Clic para subir</span> o arrastra aquí
                  </p>
                  <p className="text-xs">PNG, JPG, SVG — máx. 2MB</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {preview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Cambiar logo
        </Button>
      )}
    </div>
  )
}
