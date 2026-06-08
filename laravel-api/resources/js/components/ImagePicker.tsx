import React, { useRef, useState, DragEvent } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImagePickerProps {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  accept?: string;
  helpText?: string;
  className?: string;
}

export default function ImagePicker({
  value,
  onChange,
  label,
  accept = "image/*",
  helpText = "PNG, JPG, WEBP up to 5MB",
  className = ""
}: ImagePickerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Create preview URL if there is a value
  const previewUrl = value ? URL.createObjectURL(value) : null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!value) {
      fileInputRef.current?.click();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`image-picker-container ${className}`} style={{ width: '100%' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          {label}
        </label>
      )}
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#818cf8' : 'var(--border-color)'}`,
          borderRadius: '12px',
          background: isDragging ? 'rgba(79, 70, 229, 0.1)' : 'rgba(255,255,255,0.02)',
          padding: value ? '8px' : '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: value ? 'default' : 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'hidden',
          minHeight: value ? 'auto' : '140px'
        }}
        onMouseOver={e => {
          if (!isDragging && !value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
        onMouseOut={e => {
          if (!isDragging && !value) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              onChange(e.target.files[0]);
            }
          }}
          accept={accept}
          style={{ display: 'none' }}
        />

        {previewUrl ? (
          <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }} 
            />
            <div 
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', cursor: 'default' }}
              onMouseOver={e => e.currentTarget.style.opacity = '1'}
              onMouseOut={e => e.currentTarget.style.opacity = '0'}
            >
              <button
                onClick={handleClear}
                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                title={t('common.delete')}
              >
                <X size={24} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '50%', marginBottom: '16px', color: '#818cf8' }}>
              <UploadCloud size={32} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center' }}>
              {t('dashboard.upload.dropzone', { defaultValue: 'Click or drag image to upload' })}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {helpText}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
