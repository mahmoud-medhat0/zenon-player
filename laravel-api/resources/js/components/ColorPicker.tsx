import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure color starts with #
  const displayColor = color.startsWith('#') ? color : `#${color}`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newColor = e.target.value;
    onChange(newColor);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }} ref={popoverRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: displayColor,
          cursor: 'pointer',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title="Choose color"
      />
      <input
        type="text"
        className="settings-input"
        value={displayColor}
        onChange={handleInputChange}
        style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
      />
      
      {isOpen && (
        <div 
          className="animate-fade-in"
          dir="ltr"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 50,
            padding: '16px',
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <HexColorPicker color={displayColor} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
