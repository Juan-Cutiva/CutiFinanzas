'use client';

import { upload } from '@vercel/blob/client';
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  value?: string;
  onChange?: (url: string | undefined) => void;
  accept?: string;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  value,
  onChange,
  accept = 'image/*,application/pdf',
  className,
  disabled,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const isImage = value?.match(/\.(png|jpe?g|webp|heic)/i);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const blob = await upload(`receipts/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });
      onChange?.(blob.url);
      toast.success('Comprobante subido');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir el archivo');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (value) {
    return (
      <div className={cn('flex items-center gap-3 rounded-md border border-input p-2', className)}>
        {isImage ? (
          // biome-ignore lint/performance/noImgElement: external blob URL is fine here
          <img
            src={value}
            alt="Comprobante"
            className="size-16 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-16 place-items-center rounded bg-muted">
            <FileText className="size-6 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Comprobante adjunto</p>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Ver archivo
          </a>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Quitar comprobante"
          onClick={() => onChange?.(undefined)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onPick}
        disabled={disabled || isUploading}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <Upload className="size-4 animate-pulse" aria-hidden />
            Subiendo…
          </>
        ) : (
          <>
            <ImageIcon className="size-4" aria-hidden />
            Adjuntar comprobante
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">JPG, PNG, WebP, HEIC o PDF — máx. 8MB.</p>
    </div>
  );
}
